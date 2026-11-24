# YTB Sınav Hazırlık

YTB (Yurtdışı Türkler ve Akraba Topluluklar Başkanlığı) Uzman Yardımcılığı sınavı (19.12.2026) için kişisel çalışma uygulaması. Telefona "Ana ekrana ekle" ile kurulabilir ve kurulduktan sonra çevrim dışı da çalışır.

## İçerik

- **40 konu**: adım adım ders (ön soru, kısa parçalar, yazarak hatırlama kartları, son tur, "neden?" sorusu, konu soruları)
- **262 kart**: aralıklı tekrar, sınav tarihine göre ayarlanan aralıklarla
- **279 soru**: her biri resmi kaynağa bağlı açıklamalı, ayrıca deneme sınavı modu
- **Yazılı hazırlık**: 26 kompozisyon konusu ve kompozisyon planı, 11 çeviri metni (9 İngilizceden Türkçeye, 2 Türkçeden İngilizceye) ve örnek çevirileri; 15 İngilizce kompozisyon konusu ve İngilizce yazım rehberi, Dışişleri meslek memurluğu sınavının resmî örnek soruları, YTB sitesinden 12 Türkçe-İngilizce paralel metin ve 60 kurum terimi
- **Notlarım**: kendi notların; konuya bağlanabilir, aranabilir, sorulardan ve konu notlarından doğrudan not alınabilir

Yöntemler ve kaynakları uygulamada "Bugün → Bu uygulama nasıl öğretiyor?" bölümünde.

## Dosyalar

| Dosya | İçerik |
|---|---|
| `index.html` | Sayfa ve stiller |
| `app.js` | Uygulama mantığı (tekrar takvimi, dersler, deneme) |
| `questions.json` | Test soruları, yazılı ve çeviri konuları |
| `writing.json` | İngilizce kompozisyon, Dışişleri örnekleri, paralel YTB metinleri, terimler |
| `lessons.json` | Konu anlatımları |
| `cards.json` | Tekrar kartları (`u`: kontrol parçaları, `need`: yeterli parça sayısı) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Telefona kurulum ve çevrim dışı çalışma |

İçerik dosyaları değiştiğinde `sw.js` içindeki `VERSION` değerini artır.

## İlerleme

İlerleme tarayıcının yerel deposunda (`localStorage`, `ytb:` anahtarları) saklanır ve hiçbir sunucuya gönderilmez. Cihaz değiştirmek için: Bugün → "İlerlemeni başka cihaza taşı" → Dışa aktar, diğer cihazda İçe aktar.

## Yerelde çalıştırma

```
python -m http.server 8000
```

Ardından `http://localhost:8000` adresini aç. Dosyayı çift tıklayarak açmak çalışmaz, çünkü içerik `fetch` ile yükleniyor.
