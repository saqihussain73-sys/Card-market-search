#!/usr/bin/env python3
"""Isolated historical-price research. USD observations; no execution or investment advice."""
import argparse
import csv
import datetime as dt
import json
import os
import sqlite3
import statistics

SCHEMA = """CREATE TABLE IF NOT EXISTS prices (
 date TEXT NOT NULL, product_id TEXT NOT NULL, sub_type TEXT NOT NULL,
 name TEXT NOT NULL, set_name TEXT NOT NULL, kind TEXT NOT NULL,
 market REAL NOT NULL CHECK(market > 0),
 PRIMARY KEY(date, product_id, sub_type));"""

def connect(path):
    con = sqlite3.connect(path)
    con.execute(SCHEMA)
    return con

def ingest(con, date, path):
    dt.date.fromisoformat(date)
    with open(path, encoding="utf-8") as f:
        records = json.load(f)
    if not isinstance(records, list):
        raise ValueError("Input must be a JSON array")
    rows = []
    for p in records:
        market = float(p["market"])
        if market <= 0:
            continue
        rows.append((date, str(p["product_id"]), str(p.get("sub_type", "Normal")),
                     str(p["name"]), str(p["set_name"]), str(p.get("kind", "card")), market))
    with con:
        con.executemany("INSERT OR REPLACE INTO prices VALUES (?,?,?,?,?,?,?)", rows)
    return len(rows)

def signals(con, asof=None, drop=0.30, set_margin=0.15, peak_days=180, min_obs=3):
    if not 0 <= drop < 1 or not 0 <= set_margin < 1 or peak_days < 1:
        raise ValueError("Invalid strategy thresholds")
    asof = asof or con.execute("SELECT MAX(date) FROM prices").fetchone()[0]
    if not asof:
        return []
    cutoff = (dt.date.fromisoformat(asof) - dt.timedelta(days=peak_days)).isoformat()
    rows = con.execute("""SELECT date,product_id,sub_type,name,set_name,kind,market
      FROM prices WHERE date BETWEEN ? AND ? ORDER BY date""", (cutoff, asof)).fetchall()
    series = {}
    for date, pid, sub, name, set_name, kind, price in rows:
        series.setdefault((pid, sub), []).append((date, name, set_name, kind, price))
    candidates = []
    for (pid, sub), obs in series.items():
        if len(obs) < min_obs or obs[-1][0] != asof:
            continue
        smooth = [statistics.median([x[4] for x in obs[max(0,i-2):i+1]])
                  for i in range(len(obs))]
        peak = max(smooth)
        current = smooth[-1]
        candidates.append(dict(product_id=pid, sub_type=sub, name=obs[-1][1],
          set_name=obs[-1][2], kind=obs[-1][3], date=asof, market=obs[-1][4],
          smooth=current, peak=peak, drop=1-current/peak))
    by_set = {}
    for x in candidates:
        by_set.setdefault(x["set_name"], []).append(x["drop"])
    for x in candidates:
        x["set_drop"] = statistics.median(by_set[x["set_name"]])
        x["set_adjusted"] = x["drop"] - x["set_drop"]
    return sorted([x for x in candidates if x["drop"] >= drop and
                   x["set_adjusted"] >= set_margin], key=lambda x: -x["set_adjusted"])

def grade(raw, graded, probabilities, fee, shipping=10, sell_fee=.12, recovery=.5):
    if raw <= 0 or fee < 0 or shipping < 0 or not 0 <= sell_fee < 1:
        raise ValueError("Invalid costs")
    if set(graded) != {7,8,9,10} or set(probabilities) != {7,8,9,10}:
        raise ValueError("Require prices and probabilities for grades 7-10")
    if any(p < 0 or p > 1 for p in probabilities.values()) or sum(probabilities.values()) > 1+1e-9:
        raise ValueError("Grade probabilities must total at most 1")
    cost = raw + fee + shipping
    net = {g: graded[g]*(1-sell_fee)-cost for g in graded}
    low = recovery*raw*(1-sell_fee)-cost
    ev = sum(probabilities[g]*net[g] for g in net) + max(0,1-sum(probabilities.values()))*low
    return dict(cost=cost, net=net, ev=ev, roi=ev/cost)

def selftest():
    import tempfile
    with tempfile.TemporaryDirectory() as temp:
        con = connect(os.path.join(temp, "test.db"))
        for i in range(8):
            day = (dt.date(2025,1,1)+dt.timedelta(days=i*7)).isoformat()
            data = [
                dict(product_id="a", name="A", set_name="S", market=100 if i<4 else 50),
                dict(product_id="b", name="B", set_name="S", market=100),
                dict(product_id="c", name="C", set_name="S", market=100)]
            path = os.path.join(temp, "day.json")
            with open(path, "w", encoding="utf-8") as f: json.dump(data,f)
            assert ingest(con,day,path)==3
        hits=signals(con,drop=.30,set_margin=.15)
        assert len(hits)==1 and hits[0]["product_id"]=="a",hits
        result=grade(100,{7:90,8:130,9:200,10:450},
                     {7:.15,8:.30,9:.45,10:.10},25)
        assert abs(result["ev"]-30)<1e-9,result
        assert abs(result["net"][9]-41)<1e-9,result
        assert abs(result["roi"]-30/135)<1e-9,result
        try: grade(100,{7:90,8:130,9:200,10:450},
                   {7:.5,8:.5,9:.5,10:.5},25)
        except ValueError: pass
        else: raise AssertionError("Invalid probabilities accepted")
        print("PASS: ingestion, isolated drop detection, grading EV, ROI and probability validation")

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--db",default=os.environ.get("TCG_RESEARCH_DB","research/tcg.db"))
    sub=p.add_subparsers(dest="command",required=True)
    a=sub.add_parser("ingest");a.add_argument("--date",required=True);a.add_argument("--json",required=True)
    a=sub.add_parser("scan");a.add_argument("--date");a.add_argument("--drop",type=float,default=.30);a.add_argument("--set-margin",type=float,default=.15)
    sub.add_parser("selftest")
    args=p.parse_args()
    if args.command=="selftest": selftest();return
    con=connect(args.db)
    if args.command=="ingest": print("Imported",ingest(con,args.date,args.json),"observations")
    else: print(json.dumps(signals(con,args.date,args.drop,args.set_margin),indent=2))

if __name__=="__main__": main()
