"""Bağımsız referans: aynı TLE'lerle skyfield (python-sgp4 + JPL DE421 Güneş) ile görünür geçişler.

Çıktı testler/referans.json; testler/gecis.test.js tarayıcı kodunun sonuçlarını bununla karşılaştırır.
Görünür kısım sitedeki tanımla aynı: uydu ≥10°, Güneş ışığı alıyor, gözlemcide Güneş ≤ −6°.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from skyfield.api import EarthSatellite, Loader, wgs84

KOK = Path(__file__).parent
SEHIRLER = {"İstanbul": (41.01, 28.9603), "Ankara": (39.9358, 32.8387),
            "Van": (38.5019, 43.4167), "İzmir": (38.4127, 27.1384)}
SECILEN = [25544, 48274, 20580, 27386, 25994, 23088, 16908, 39766]  # ISS, Tiangong, Hubble, ENVISAT, TERRA, SL-16, AJISAI, ALOS-2
BAS = datetime(2026, 11, 5, 12, tzinfo=timezone.utc)
GUN = 3


def main():
    load = Loader(KOK / ".skyfield")
    ts = load.timescale()
    eph = load("de421.bsp")
    gunes, dunya = eph["sun"], eph["earth"]
    veri = json.loads((KOK / "testler" / "uydular_sabit.json").read_text(encoding="utf-8"))
    uydular = [u for u in veri["uydular"] if u["norad"] in SECILEN]
    t0, t1 = ts.from_datetime(BAS), ts.tt_jd(ts.from_datetime(BAS).tt + GUN)
    cikti = []
    for sehir, (enl, boy) in SEHIRLER.items():
        yer = wgs84.latlon(enl, boy, 0)
        for u in uydular:
            s = EarthSatellite(u["s1"], u["s2"], u["kod"], ts)
            t, olay = s.find_events(yer, t0, t1, altitude_degrees=0.0)
            i = 0
            while i < len(olay):
                if olay[i] != 0:
                    i += 1; continue
                j = i
                while j < len(olay) and olay[j] != 2:
                    j += 1
                if j >= len(olay):
                    break
                a, b = t[i].tt, t[j].tt
                n = int((b - a) * 86400) + 1
                tt = ts.tt_jd(a + np.arange(n) / 86400)
                fark = (s - yer).at(tt)
                alt, az, _ = fark.altaz()
                isik = s.at(tt).is_sunlit(eph)
                galt = (dunya + yer).at(tt).observe(gunes).apparent().altaz()[0].degrees
                gor = (alt.degrees >= 10) & isik & (galt <= -6)
                if gor.any():
                    k = np.flatnonzero(gor)
                    k0, k1 = k[0], k[-1]
                    km = k0 + int(np.argmax(alt.degrees[k0:k1 + 1]))
                    zam = lambda q: tt[q].utc_datetime().timestamp() * 1000
                    cikti.append({"sehir": sehir, "enlem": enl, "boylam": boy, "norad": u["norad"],
                                  "bas": zam(k0), "basAz": az.degrees[k0], "tepe": zam(km),
                                  "tepeEl": alt.degrees[km], "son": zam(k1), "sonAz": az.degrees[k1]})
                i = j + 1
    # Güneş yüksekliği örnekleri (her şehirde 3 gün boyunca 37 dakikada bir).
    gunes_ornek = []
    tt = ts.tt_jd(t0.tt + np.arange(0, GUN, 37 / 1440))
    for sehir, (enl, boy) in SEHIRLER.items():
        galt = (dunya + wgs84.latlon(enl, boy, 0)).at(tt).observe(gunes).apparent().altaz()[0].degrees
        for q in range(len(tt)):
            gunes_ornek.append([enl, boy, tt[q].utc_datetime().timestamp() * 1000, galt[q]])
    (KOK / "testler" / "referans.json").write_text(
        json.dumps({"bas": BAS.timestamp() * 1000, "gun": GUN, "gecisler": cikti, "gunes": gunes_ornek}, ensure_ascii=False, indent=1),
        encoding="utf-8")
    print(len(cikti), "görünür geçiş")


if __name__ == "__main__":
    main()
