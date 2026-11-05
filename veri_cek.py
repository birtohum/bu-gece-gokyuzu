"""CelesTrak'tan parlak uyduların yörünge öğelerini (TLE) çekip site/veri/uydular.json'a yazar.

GitHub Actions günde birkaç kez çalıştırır; site tarayıcıda CelesTrak'a hiç bağlanmaz.
Bir grup çekilemezse eski dosya korunur (bozuk veri yazılmaz).
"""
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

KAYNAK = "https://celestrak.org/NORAD/elements/gp.php?GROUP={grup}&FORMAT=tle"
GRUPLAR = ["stations", "visual"]
CIKTI = Path(__file__).parent / "site" / "veri" / "uydular.json"

# Türkçe görünen adlar; listede olmayanlar CelesTrak adıyla kalır.
ADLAR = {
    25544: "Uluslararası Uzay İstasyonu (ISS)",
    48274: "Çin Uzay İstasyonu Tiangong",
    20580: "Hubble Uzay Teleskobu",
}
# Kenetli modüller / araçlar ana istasyonla aynı yerdedir; ayrı satır olarak tekrar göstermeyiz.
ISTASYON_PARCALARI = {"POISK", "ISS (NAUKA)", "CSS (WENTIAN)", "CSS (MENGTIAN)"}


def tle_coz(metin):
    satirlar = [s.rstrip() for s in metin.strip().splitlines() if s.strip()]
    if len(satirlar) % 3:
        raise ValueError("TLE satır sayısı 3'ün katı değil")
    for i in range(0, len(satirlar), 3):
        ad, s1, s2 = satirlar[i : i + 3]
        if not (s1.startswith("1 ") and s2.startswith("2 ")):
            raise ValueError(f"bozuk TLE: {ad}")
        yield ad.strip(), s1, s2


def epoch(s1):
    yy = int(s1[18:20])
    gun = float(s1[20:32])
    yil = 2000 + yy if yy < 57 else 1900 + yy
    t = datetime(yil, 1, 1, tzinfo=timezone.utc).timestamp() + (gun - 1) * 86400
    return datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def cek(grup):
    for deneme in range(3):
        try:
            r = requests.get(KAYNAK.format(grup=grup), timeout=60,
                             headers={"User-Agent": "bu-gece-gokyuzu (github.com/birtohum)"})
            r.raise_for_status()
            return list(tle_coz(r.text))
        except Exception as e:  # noqa: BLE001
            print(f"{grup}: {e}", file=sys.stderr)
            time.sleep(10 * (deneme + 1))
    raise RuntimeError(f"{grup} çekilemedi")


def main():
    gorulen, uydular = set(), []
    for grup in GRUPLAR:
        for ad, s1, s2 in cek(grup):
            norad = int(s1[2:7])
            if norad in gorulen or ad in ISTASYON_PARCALARI:
                continue
            # stations grubunda yalnız ana istasyonları, insanlı/kargo araçlarını değil, alıyoruz:
            # kargo ve küp uydular sönüktür ya da istasyona kenetlidir.
            if grup == "stations" and norad not in ADLAR:
                continue
            gorulen.add(norad)
            uydular.append({"ad": ADLAR.get(norad, ad), "kod": ad, "norad": norad,
                            "epoch": epoch(s1), "s1": s1, "s2": s2})
    if len(uydular) < 50 or 25544 not in gorulen:
        raise RuntimeError(f"beklenenden az uydu ({len(uydular)}); dosya yazılmadı")
    veri = {"guncelleme": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "kaynak": "CelesTrak GP (stations, visual)", "uydular": uydular}
    CIKTI.parent.mkdir(parents=True, exist_ok=True)
    CIKTI.write_text(json.dumps(veri, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(uydular)} uydu yazıldı: {CIKTI}")


if __name__ == "__main__":
    main()
