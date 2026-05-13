# Prime Trade Inventory - Single Store Notes

This app is configured for one inventory operation. Users, products, sales, invoices, alerts, stock adjustments, and reports all belong to the same business context.

## Access Model

- One admin account can manage users, products, stock adjustments, reports, and invoices.
- Managers and staff can work in the operational areas allowed by their role.
- Users are no longer assigned to separate locations.
- There is no store switcher or store-scoped filtering in the UI.

## Data Compatibility

The app runs in a single-store model. Product and transaction records are not scoped by location, and the UI/API do not accept a store choice.
