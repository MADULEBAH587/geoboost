"use client";

export function HotspotChoice({ questionId, options, selected, disabled, onSelect }: { questionId:string; options:string[]; selected:string|null; disabled:boolean; onSelect:(value:string)=>void }) {
  if (questionId === "GB02-021") {
    return (
      <div className="hotspot-wrap" aria-label="Hotspot rujukan grid">
        <div className="hotspot-head"><span>INTERAKTIF</span><b>Klik petak jawapan pada grid</b></div>
        <div className="grid-hotspot">
          {options.map((option,i)=><button type="button" key={option} disabled={disabled} onClick={()=>onSelect(option)} className={selected===option?"picked":""} style={{gridArea:`p${i+1}`}}><small>Petak</small><b>{option}</b></button>)}
        </div>
      </div>
    );
  }
  if (questionId === "GB07-015") {
    const order = ["Sejuk","Sejuk sederhana","Panas sederhana","Panas"];
    return (
      <div className="hotspot-wrap" aria-label="Hotspot zon iklim Asia">
        <div className="hotspot-head"><span>INTERAKTIF</span><b>Klik zon iklim pada rajah</b></div>
        <div className="climate-hotspot">
          {order.filter(x=>options.includes(x)).map((option,i)=><button type="button" key={option} disabled={disabled} onClick={()=>onSelect(option)} className={`band band-${i} ${selected===option?"picked":""}`}><span>{option}</span></button>)}
        </div>
      </div>
    );
  }
  return null;
}

export function isHotspotQuestion(id:string) { return id === "GB02-021" || id === "GB07-015"; }
