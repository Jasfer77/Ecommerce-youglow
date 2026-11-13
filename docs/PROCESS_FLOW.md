# You Glow Cebu — System Process Flow

This document separates the current system into clear business modules and shows how a customer order moves from product selection to completion.

## 1. Complete transaction flow

```mermaid
flowchart TD
    A[Customer visits storefront] --> B[Browse products]
    B --> C[Add products to cart]
    C --> D{Customer signed in?}
    D -- No --> E[Register or sign in]
    E --> F[Complete customer profile]
    D -- Yes --> G[Review cart]
    F --> G
    G --> H[Confirm delivery address and landmark]
    H --> I[Submit order]
    I --> J[System validates stock and reserves quantity]
    J --> K[Order created: Awaiting admin review]
    K --> L[Order transaction appears in Messages]
    L --> M[Admin reviews items, address and conversation]
    M --> N[Admin sets delivery fee]
    N --> O[Customer verifies address and chooses fee option]
    O --> P{Delivery fee payment}
    P -- Include in total --> Q[Product total plus delivery fee]
    P -- Pay on arrival --> R[Product total only and delivery fee due on arrival]
    Q --> S[Admin confirms final payable total]
    R --> S
    S --> T[Customer selects GCash or BPI]
    T --> U[Customer enters reference and uploads receipt]
    U --> V[Admin reviews receipt]
    V --> W{Payment valid?}
    W -- No --> X[Reject payment and request correction]
    X --> T
    W -- Yes --> Y[Payment verified]
    Y --> Z[Pack order]
    Z --> AA[Mark order in transit]
    AA --> AB[Customer confirms order received]
    AB --> AC[Order completed]
    AC --> AD[Customer may submit rating and feedback]
    AD --> AE[Admin publishes or hides feedback]
```

## 2. Customer account module

**Purpose:** Customer identity, profile, saved delivery details and secure access.

```mermaid
flowchart LR
    A[Register] --> B[Customer account]
    C[Sign in] --> B
    D[Forgot password] --> E[One-time verification code]
    E --> F[Reset password]
    F --> C
    B --> G[Dashboard]
    B --> H[Profile and photo]
    B --> I[Saved address and landmark]
    B --> J[Orders]
    B --> K[Messages]
    B --> L[Cart]
```

Main responsibilities:

- Register, sign in, sign out and reset a forgotten password.
- Maintain name, email, phone number, profile picture, address and landmark.
- View only the signed-in customer's orders, messages, receipts and feedback.

## 3. Product and cart module

**Purpose:** Display active products and prepare an order before checkout.

```mermaid
flowchart LR
    A[Admin creates product] --> B[Product has name, price, quantity and description]
    B --> C{Visible and active?}
    C -- Yes --> D[Shown in storefront]
    C -- No --> E[Hidden from storefront]
    D --> F[Customer views details]
    F --> G[Add to cart]
    G --> H[Change quantity or remove item]
    H --> I[Proceed to checkout]
```

The server rechecks product availability during checkout. The cart alone does not reserve stock.

## 4. Checkout and stock reservation module

**Purpose:** Create a valid order and prevent overselling.

```mermaid
flowchart TD
    A[Checkout request] --> B[Validate customer and delivery details]
    B --> C[Lock selected products and stock records]
    C --> D{Enough stock?}
    D -- No --> E[Reject order and show stock error]
    D -- Yes --> F[Calculate product subtotal]
    F --> G[Create order and order items]
    G --> H[Deduct stock using earliest-expiry records first]
    H --> I[Generate YGC order number]
    I --> J[Notify administrators]
```

The initial workflow status is `awaiting_admin_review`. Payment is not collected during initial checkout.

## 5. Message transaction module

**Purpose:** Keep the order discussion and transaction actions in one chronological conversation.

```mermaid
flowchart LR
    A[Order created] --> B[Order summary inserted in conversation]
    B --> C[Customer and admin exchange messages]
    C --> D[Admin performs order action]
    D --> E[Updated transaction card appears in history]
    E --> F[Customer performs next required action]
    F --> E
    E --> G[Completed order remains in its chronological position]
```

Messages may include text, links and supported image attachments. Order actions remain controlled by the order workflow; a normal chat message cannot change an order status.

## 6. Delivery fee and final-total module

```mermaid
stateDiagram-v2
    [*] --> AwaitingAdminReview
    AwaitingAdminReview --> AwaitingAddressConfirmation: Admin sets delivery fee
    AwaitingAddressConfirmation --> AwaitingAdminTotalConfirmation: Customer confirms address and fee option
    AwaitingAdminTotalConfirmation --> AwaitingPayment: Admin confirms payable total
    AwaitingPayment --> PaymentVerification: Customer submits payment
```

Fee options:

- **Included in total:** payable amount = product subtotal − discount + delivery fee.
- **Pay on arrival:** online payable amount = product subtotal − discount; delivery fee remains due to the delivery personnel.

## 7. Payment module

**Purpose:** Configure payment methods and verify customer payments.

```mermaid
flowchart TD
    A[Admin configures GCash or BPI] --> B[Customer selects active method]
    B --> C[Enter payment reference]
    C --> D[Upload JPG, PNG or WebP receipt]
    D --> E[System stores receipt privately]
    E --> F[Admin views receipt securely]
    F --> G{Verify payment?}
    G -- Reject --> H[Customer receives reason and resubmits]
    G -- Approve --> I[Order ready for fulfillment]
```

Receipts are protected files and are available only to the related customer and authorized administrators.

## 8. Order fulfillment module

```mermaid
stateDiagram-v2
    [*] --> Pending
    Pending --> Packing: Payment verified
    Packing --> InTransit: Order handed to courier
    InTransit --> Delivered: Customer confirms receipt
    Delivered --> Completed
    Pending --> Cancelled: Customer or admin cancels
    Cancelled --> Archived: Admin archives
    Completed --> Archived: Admin archives
```

Rules:

- Customers may cancel only while an order is still pending.
- Cancelling a pending order restores its reserved quantities to inventory and adds a message to the conversation.
- Permanent deletion is limited to cancelled or archived orders and requires confirmation.

## 9. Inventory module

**Purpose:** Track quantities, low stock and expiry details separately from the product catalog.

```mermaid
flowchart TD
    A[Admin adds product quantity] --> B[Inventory stock record]
    B --> C[Dashboard inventory chart]
    B --> D{At or below low-stock threshold?}
    D -- Yes --> E[Highlight low stock]
    D -- No --> F[Normal stock]
    B --> G[Expiry report]
    H[Completed checkout] --> I[Decrease quantity]
    J[Pending order cancelled] --> K[Restore quantity]
```

## 10. Discounts module

```mermaid
flowchart LR
    A[Admin creates discount] --> B[Set percentage, minimum and expiry]
    B --> C{Customer assignment}
    C --> D[Selected customers]
    C --> E[All customers]
    D --> F[Eligible customer receives discount]
    E --> F
    F --> G[Discount eligibility is stored]
```

The discount administration and customer-assignment functions are implemented. The current server checkout still creates orders with `discount_amount` set to zero, so automatic application of an assigned discount to checkout totals requires a separate implementation step.

## 11. Customer feedback module

```mermaid
flowchart LR
    A[Completed verified order] --> B[Rate now]
    B --> C[Customer submits stars and comment]
    C --> D[Admin feedback list]
    D --> E{Moderation}
    E -- Publish --> F[Visible in Community That Glows]
    E -- Hide --> G[Stored but not public]
```

Only feedback connected to a completed customer order should be treated as verified-order feedback.

## 12. Admin modules

| Module | Primary responsibility |
|---|---|
| Dashboard | Net product revenue, order counts, top-selling product, active customers, sales graph, inventory chart and feedback |
| Products | Create, edit, hide and delete storefront products |
| Orders | Review details, update fulfillment, archive and safely delete eligible orders |
| Inventory | Manage quantities, low-stock thresholds and expiry records |
| Customers | View customer profiles without granting administrator access |
| Messages | Handle the shared customer-support and order-transaction inbox |
| Discounts | Create discounts and assign them to selected or all customers |
| Reports | Generate date-filtered sales, product, order, inventory and expiry reports |
| Payments | Configure active GCash and BPI account or QR information |
| Feedback | Publish or hide verified customer ratings and comments |
| Admins | Add and maintain administrator accounts separately from customers |

## 13. Reports module

```mermaid
flowchart TD
    A[Select report folder] --> B{Report type}
    B --> C[Sales from completed orders only]
    B --> D[Products]
    B --> E[Order details]
    B --> F[Inventory details]
    B --> G[Expiry details]
    C --> H[Choose date range]
    D --> H
    E --> H
    F --> H
    G --> H
    H --> I[List-style report preview]
    I --> J[Export PDF]
    I --> K[Export Excel]
```

Sales revenue excludes delivery fees.

## 14. Email notification module

```mermaid
flowchart LR
    A[Order or support event] --> B[Notification service]
    B --> C[Administrator mailbox]
    B --> D[Related customer's email]
    C --> E[Open website to take action]
    D --> E
```

Email notifications alert users to activity; private order, receipt and message details remain inside the authenticated website.

## 15. Module boundaries

```mermaid
flowchart TB
    Storefront[Public storefront] --> Auth[Authentication]
    Auth --> Customer[Customer account]
    Customer --> Cart[Cart and checkout]
    Cart --> Orders[Orders]
    Orders <--> Messages[Messages and transaction actions]
    Orders <--> Inventory[Inventory]
    Orders <--> Payments[Payments]
    Orders --> Feedback[Customer feedback]
    Discounts[Discounts] --> Orders
    Orders --> Reports[Reports]
    Inventory --> Reports
    Admin[Admin portal] --> Products[Products]
    Admin --> Orders
    Admin --> Messages
    Admin --> Inventory
    Admin --> Payments
    Admin --> Discounts
    Admin --> Feedback
    Admin --> Reports
    Orders --> Notifications[Email notifications]
    Messages --> Notifications
```

Each module has one main responsibility. Cross-module changes should occur through the existing controllers and services so that authorization, stock restoration, private file access and notifications remain consistent.
