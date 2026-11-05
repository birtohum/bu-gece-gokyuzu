"""Wikidata il merkezi koordinatlarından site/js/iller.js üretir (bir kez çalıştırıldı)."""
import json, re, sys
sys.path.insert(0, r"C:\Users\PURNACI\Desktop\hava")
from hava.iller import ILLER
b = json.load(open("araclar/wikidata_iller.json", encoding="utf-8"))["results"]["bindings"]
k = {}
for x in b:
    ad = x["ilLabel"]["value"]
    m = re.match(r"Point\(([-\d.]+) ([-\d.]+)\)", x["k"]["value"])
    k.setdefault(ad, (round(float(m[2]), 4), round(float(m[1]), 4)))
k.setdefault("Bingöl", (38.8847, 40.4939))  # Wikidata sorgusunda plaka/merkez eksik
satir = []
for p, ad in ILLER.items():
    enl, boy = k[ad]
    satir.append(f'  [{p}, "{ad}", {enl}, {boy}]')
open("site/js/iller.js", "w", encoding="utf-8").write(
    "// 81 il merkezi: [plaka, ad, enlem, boylam]. Kaynak: Wikidata (il merkezi P625), Kas 2026.\n"
    "export const ILLER = [\n" + ",\n".join(satir) + "\n];\n")
print(len(satir))
