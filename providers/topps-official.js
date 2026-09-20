const sets=[
["toppsspongebob","2025 Topps Chrome SpongeBob 25th Anniversary Hobby Box","Autographs and sketch cards possible; Topps reports two autographs per five hobby boxes and sketches one per ten boxes.","https://ripped.topps.com/uk/2025-topps-chrome-spongebob-25th-anniversary-box-buyers-guide/"],
["toppsstarwars","2025 Topps Chrome Star Wars Hobby Box","One autograph guaranteed per hobby box.","https://uk.topps.com/products/2025-topps-chrome%C2%AE-star-wars-hobby-box"],
["toppsmarvel","2025 Topps Chrome Marvel Hobby Box","Autograph availability requires product-specific official confirmation.","https://www.topps.com/pages/checklists"],
["toppsdisney","2025 Topps Chrome Disney Hobby Box","Autograph availability requires product-specific official confirmation.","https://www.topps.com/pages/checklists"],
["toppswwe","2026 Topps Chrome WWE Hobby Box","Two Chrome autograph cards per hobby box.","https://www.topps.com/products/2026-topps-chrome-wwe-hobby-box"],
["toppssoccer","2024/25 Topps Chrome UEFA Club Competitions Hobby Box","Autograph availability requires product-specific official confirmation.","https://www.topps.com/pages/checklists"],
["toppsbasketball","2025-26 Topps Chrome Basketball Hobby Box","Look for one autograph per hobby box.","https://uk.topps.com/products/2025-26-topps-chrome%C2%AE-basketball-hobby-box"],
["toppsamericanfootball","2025 Topps Chrome Football Hobby Box","Autograph cards are included in the release; per-box odds require checking the official odds sheet.","https://launches.topps.com/en-US/launch/2025-topps-chrome-football-hobby-box"],
["toppsbaseball","2025 Topps Chrome Baseball Update Series Hobby Box","Autograph cards are included in the release; per-box odds require checking the official odds sheet.","https://uk.topps.com/pages/topps-chrome-baseball-update-series"],
["toppsf1","2025 Topps Chrome Formula 1 Hobby Box","Autographs are included in the release; per-box odds require checking the official odds sheet.","https://uk.topps.com/products/2025-topps-chrome-formula-1%C2%AE-hobby-box"],
["toppsufc","2026 Topps Chrome UFC Hobby Box","Two Chrome autographs per hobby box.","https://uk.topps.com/products/2026-topps-chrome%C2%AE-ufc-hobby-box"]
].filter(x=>!x[2].includes("requires product-specific official confirmation"));
const catalog={};for(const [key,product,signatureInfo,sourceUrl] of sets){(catalog[key]??=[]).push({set:product.replace(/ Hobby Box$/,""),product,productId:"official-"+key,type:"hobby",marketPrice:null,lowPrice:null,chases:[],releaseDate:null,signatureInfo,sourceUrl});}
module.exports={catalog,get(key){if(!Object.hasOwn(catalog,key))return {topps:true,status:"no_verified_autograph_sets",boxes:[]};return {topps:true,status:"official_autograph_catalogue",boxes:catalog[key]};}};
