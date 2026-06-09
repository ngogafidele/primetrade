import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export type ProductsTableRow = {
  id: string
  name: string
  sku: string
  unit?: string
  quantity: number
}

export function ProductsTable({ rows }: { rows: ProductsTableRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>SKU</TableHead>
          <TableHead>Quantity</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.id}
            className={
              row.quantity < 0 ? "bg-red-50 hover:bg-red-100/80" : undefined
            }
          >
            <TableCell>{row.name}</TableCell>
            <TableCell>{row.sku}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <span>
                  {row.quantity} {row.unit ?? "pcs"}
                </span>
                {row.quantity < 0 ? (
                  <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    Negative stock
                  </span>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
