// DEV MODE: Solana WalletProvider tamamen kaldirildi.
// HUD/Game test ortami - cuzdan baglantisi, RPC, polyfill (Buffer) gerekmez.
//
// StrictMode KAPALI: React StrictMode dev'de component'leri mount->unmount->remount
// yapiyor. Game component'inin cleanup'i `cleanupTimer()` cagiriyor ve bu, yeni
// baslatilan countdown setInterval'ini hemen siliyor (countdown 5'te takiliyor).
// Prod'da StrictMode double-mount yapmaz, o yuzden orijinalde sorun cikmiyor.
// Lokal HUD testi icin StrictMode'u devre disi birakiyoruz.
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(<App />)
