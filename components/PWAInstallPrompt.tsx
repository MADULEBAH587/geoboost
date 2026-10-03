"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{outcome:"accepted"|"dismissed"}> };

export function PWAInstallPrompt(){
  const [installEvent,setInstallEvent]=useState<InstallEvent|null>(null);
  const [show,setShow]=useState(false);
  const [ios,setIos]=useState(false);

  useEffect(()=>{
    if(window.location.pathname.startsWith("/guru")) return;
    const standalone=window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone===true;
    if(standalone) return;
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setShow(true);
    const handler=(event:Event)=>{ event.preventDefault(); setInstallEvent(event as InstallEvent); setShow(true); };
    window.addEventListener("beforeinstallprompt",handler);
    return()=>window.removeEventListener("beforeinstallprompt",handler);
  },[]);

  async function install(){
    if(!installEvent) return;
    await installEvent.prompt();
    const choice=await installEvent.userChoice;
    if(choice.outcome==="accepted") setShow(false);
    setInstallEvent(null);
  }

  if(!show) return null;
  return <div className="pwa-install-overlay" role="dialog" aria-modal="true" aria-label="Pasang GeoBoost">
    <div className="pwa-install-card">
      <div className="pwa-install-icon">G</div>
      <div><small>GEOBOOST DI TELEFON</small><h2>Pasang GeoBoost</h2><p>{ios?"Tekan Share, kemudian pilih Add to Home Screen untuk pasang GeoBoost.":"Pasang GeoBoost supaya boleh dibuka terus dari skrin utama seperti aplikasi."}</p></div>
      {installEvent?<button className="primary" onClick={install}>Pasang Sekarang</button>:<p className="pwa-install-help">{ios?"Gunakan menu Share Safari.":"Jika butang pemasangan belum tersedia, gunakan menu pelayar → Install app / Add to Home screen."}</p>}
      <button className="pwa-install-later" onClick={()=>setShow(false)}>Nanti</button>
    </div>
  </div>;
}
