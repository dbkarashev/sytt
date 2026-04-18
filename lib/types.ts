export type Lang = "en" | "ru";

export type Story = {
  id: string;
  lat: number;
  lng: number;
  text: string;
  feeling: string | null;
  coped: string | null;
  lang: Lang;
  createdAt?: string;
};
