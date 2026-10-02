import { notFound } from "next/navigation";
import { VisualNotesClient } from "@/components/VisualNotesClient";
import { getVisualNote } from "@/lib/visualNotes";

export default async function VisualNotesPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const note=getVisualNote(Number(id));
  if(!note)notFound();
  return <VisualNotesClient note={note!}/>;
}
