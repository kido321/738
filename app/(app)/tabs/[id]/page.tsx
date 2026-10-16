import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getProducts, getStaffList, getTab } from "@/lib/data";
import { TabView } from "@/components/TabView";

export default async function TabPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStaff();
  const { id } = await params;
  const [tab, staff, products] = await Promise.all([getTab(id), getStaffList(), getProducts({ activeOnly: true })]);
  if (!tab) notFound();
  return <TabView tab={tab} staff={staff} products={products} me={me} />;
}
