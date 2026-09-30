import type { Metadata } from "next";
import { BitLab } from "../../../components/bit/BitLab";

export const metadata: Metadata = {
  title: "BIT visual lab",
  description: "Isolated 3D mascot review. This is not the public BIT site.",
};

export default function BitLabPage() {
  return <BitLab />;
}
