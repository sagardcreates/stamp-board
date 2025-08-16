import BoardClient from "./BoardClient";
import type { StampDTO } from "@/components/board/types";

function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

async function fetchStamps(): Promise<StampDTO[]> {
  return Array.from({ length: 9 }, (_, i) => ({
    id: String(i + 1),
    url: `/stamps/${i + 1}.png`,
    x: randomInRange(3200, 4800),
    y: randomInRange(2400, 3600),
    scale: randomInRange(0.28, 0.32),
    rotation: randomInRange(-1, 1),
  }));
}

export default async function Page() {
  const stamps = await fetchStamps();
  return <BoardClient stamps={stamps} />;
}
