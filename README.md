# Bu gece başının üstünden ne geçecek?

https://birtohum.github.io/bu-gece-gokyuzu/

Şehrini seç (81 il ya da tarayıcı konumu); site bu gece çıplak gözle görülebilecek Uluslararası Uzay İstasyonu,
Tiangong ve parlak uydu / roket gövdesi geçişlerini saat, yön (çıkış → batış), en yüksek nokta ve süreyle listeler,
sıradaki geçişin yolunu basit bir gökyüzü haritasında çizer.

## Nasıl çalışır

- `veri_cek.py`, CelesTrak GP verisini (`stations` ve `visual` grupları, TLE) çekip `site/veri/uydular.json`'a yazar.
  GitHub Actions (`.github/workflows/veri.yml`) bunu günde dört kez çalıştırır; site tarayıcıda CelesTrak'a bağlanmaz.
- Geçişler tarayıcıda, bir Web Worker içinde, [satellite.js](https://github.com/shashwatak/satellite-js) 5.0.0 (SGP4)
  ile hesaplanır (`site/js/gecis.js`). Güneş konumu düşük duyarlıklı formülle (Astronomical Almanac, ~0,01°) bulunur.
- **Görünür** sayılan an: uydu ufkun ≥10° üstünde, Güneş ışığı alıyor (uydu–Güneş doğrusu Dünya küresini kesmiyor)
  ve gözlemcide Güneş ≤ −6°. Listelenen başlangıç/bitiş bu görünür kısmın sınırlarıdır.

## Doğrulama (5 Kas 2026)

`npm test` iki bağımsız referansla karşılaştırır:

| Referans | Kapsam | Sonuç |
|---|---|---|
| [skyfield](https://rhodesmill.org/skyfield/) 1.55 + JPL DE421, aynı TLE (`dogrula.py` → `testler/referans.json`) | İstanbul, Ankara, Van, İzmir; 8 uydu; 3 gün; 54 görünür geçiş | 54/54 eşleşti, fazla yok. Başlangıç/tepe/bitiş farkı en kötü 1,1 sn (referans 1 sn adımlı), tepe yüksekliği en kötü 0,08°. Güneş yüksekliği en kötü 0,003°. |
| Heavens-Above (farklı yazılım, kendi TLE'si), tarayıcıda okundu (`testler/heavens_above.json`) | İstanbul, Ankara, Van; ISS ve Tiangong; 5–15 Kas; 33 geçiş | 29/33 geçiş 1,4 sn ve 0,55° içinde aynı (HA tam saniye/derece veriyor). 3'ü alacakaranlıkta başlıyor; HA görünürlüğü bizden 20 sn–4 dk erken başlatıyor (karanlık ölçütü farklı). 1'i tam 10° sınırında, bizde yok. Bizde HA'da olmayan 1 fazla geçiş var (Ankara, Tiangong, Güneş tam −6°'deyken başlıyor; HA o anı henüz yeterince karanlık saymıyor). |

Bu ölçümler hesabın doğru uygulandığını gösterir; **gerçek gökyüzündeki hata** asıl olarak TLE'nin yaşından gelir
(birkaç günlük veriyle genellikle dakikanın altı ile birkaç dakika arası; istasyon yörünge düzeltmesi yaptığında daha fazla).

## Sınırlar

- Parlaklık (kadir) hesaplanmıyor; ISS ve Tiangong'u "parlak" diye işaretliyoruz, diğerleri sönük olabilir.
- Bulut, ufku kapatan engeller, atmosferik kırılma hesaba katılmaz.
- Starlink trenleri yok (yalnız fırlatmadan sonraki birkaç gün parlak; güvenilir izlenemiyor).
- Saatler Türkiye saati (UTC+3).

## Geliştirme

```bash
npm ci && npm test
python -m venv .venv && .venv/Scripts/pip install -r requirements-dogrulama.txt && .venv/Scripts/python dogrula.py
python -m http.server -d site 8851
```

İl merkezleri Wikidata'dan (`araclar/iller_yap.py`). Lisans: Apache-2.0. satellite.js MIT lisanslıdır (`site/js/satellite.js-LICENSE.md`).
