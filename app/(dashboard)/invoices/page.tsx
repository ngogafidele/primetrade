import { connectToDatabase } from "@/lib/db/connection"
import { Sale } from "@/lib/db/models/Sale"
import { requireServerSession } from "@/lib/auth/server"
import { approvedSaleFilter } from "@/lib/db/sales-approval"
import { InvoicesPageClient } from "@/components/invoices/invoices-page-client"
import { formatInKigali } from "@/lib/utils/time"

type InvoicePageSale = {
  _id: { toString(): string }
  saleDate?: Date
  createdAt?: Date
  totalAmount: number
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const session = await requireServerSession()
  const params = await searchParams
  const requestedTab = Array.isArray(params.tab) ? params.tab[0] : params.tab

  await connectToDatabase()
  const sales = await Sale.find(approvedSaleFilter)
    .select("totalAmount saleDate createdAt")
    .sort({ saleDate: -1, createdAt: -1 })
    .lean<InvoicePageSale[]>()

  const serializedSales = sales.map((sale) => {
    const displayDate = sale.saleDate ?? sale.createdAt

    return {
      _id: sale._id.toString(),
      label: displayDate
        ? formatInKigali(displayDate, {
            month: "short",
            day: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : sale._id.toString(),
      totalAmount: sale.totalAmount,
    }
  })

  return (
    <InvoicesPageClient
      key={requestedTab === "proforma" ? "proforma" : "sales"}
      initialTab={requestedTab === "proforma" ? "proforma" : "sales"}
      sales={serializedSales}
      canCreateInvoices={true}
      canManageInvoices={session.isAdmin || session.role === "manager"}
      canDeleteInvoices={session.isAdmin}
      canApproveProformas={session.isAdmin}
    />
  )
}
