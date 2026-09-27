# Chauffeur Booking Engine Scope

## 1. Core Idea

The booking engine owns everything from:

```text
Customer enters journey
        ↓
Route calculation
        ↓
Price calculation
        ↓
Vehicle selection
        ↓
Booking creation
        ↓
Payment
        ↓
Driver assignment
        ↓
Ride execution
        ↓
Completion
```

Google Maps provides location and route information.

Your backend remains responsible for:
- Pricing
- Booking state
- Vehicle availability
- Driver assignment
- Payments
- Cancellations
- Ride status

## 2. Booking Types

Design for:
```text
ONE_WAY
RETURN
HOURLY
```

For the MVP, start with `ONE_WAY`.

## 3. Customer Journey

```text
Enter Pickup
      ↓
Enter Destination
      ↓
Select Date & Time
      ↓
Google calculates route
      ↓
Backend calculates available vehicle options + prices
      ↓
Customer chooses vehicle
      ↓
Enter passenger information
      ↓
Review booking
      ↓
Payment
      ↓
Booking confirmed
```

## 4. Google Maps Integration

For pickup and destination, store:

```text
place_id
formatted_address
latitude
longitude
```

Also calculate:

```text
distance
estimated_duration
route
```

The backend should calculate or validate route data using Google Maps APIs. Do not trust route values coming directly from the frontend.

## 5. Quote Engine

Before creating a booking, create a quote.

```text
Quote ≠ Booking
```

A quote should contain:

```text
id
customer_id
booking_type
pickup data
destination data
distance
duration
pickup_at
vehicle_type_id
base_price
distance_price
duration_price
surcharges
extras
discount
tax
total_price
currency
expires_at
created_at
```

## 6. Quote Expiry

Quotes should expire after a short period, for example 15 minutes.

Reasons:
- Pricing may change
- Vehicle availability may change
- Surcharges may change

Expired quotes cannot be converted into bookings.

## 7. Pricing Engine

Pricing should be rule-based:

```text
baseFare
+
distance × ratePerDistance
+
duration × ratePerMinute
+
surcharges
+
extras
-
discounts
```

Do not hardcode pricing logic directly inside controllers.

## 8. Vehicle Pricing

Each vehicle category should have separate rates.

Recommended `vehicle_types` fields:

```text
id
name
passenger_capacity
luggage_capacity
base_fare
price_per_distance
price_per_minute
minimum_fare
is_active
```

## 9. Pricing Rules

Future pricing rules may include:

```text
airport surcharge
night surcharge
weekend surcharge
holiday surcharge
waiting fee
meet & greet
additional stop fee
child seat
extra luggage
congestion charge
parking
```

Recommended table:

```text
pricing_rules
```

Possible fields:

```text
id
rule_type
name
calculation_type
value
conditions
is_active
```

## 10. Vehicle Selection

The customer selects a vehicle category, not a specific driver's vehicle.

Example:

```json
[
  {
    "vehicleType": "EXECUTIVE",
    "passengers": 4,
    "luggage": 3,
    "price": 65
  },
  {
    "vehicleType": "LUXURY",
    "passengers": 4,
    "luggage": 2,
    "price": 90
  }
]
```

The actual driver and vehicle are assigned later.

## 11. Booking Creation

When the customer accepts the quote:

```text
Quote
  ↓
Booking
```

Create the booking using a snapshot of the quote.

Preserve:
```text
route
distance
duration
price
vehicle category
pickup time
```

## 12. Booking Table

Core fields:

```text
id
reference_number
customer_id
quote_id
booking_type
vehicle_type_id
pickup_at
passenger_count
luggage_count
flight_number
special_instructions
distance
estimated_duration
subtotal
tax
discount
total_price
currency
payment_status
booking_status
created_at
updated_at
```

Use a public booking reference instead of exposing the database ID.

Example:
```text
CH-20260927-A82K
```

## 13. Booking Stops

Use a separate `booking_stops` table.

Fields:

```text
id
booking_id
type
place_id
address
latitude
longitude
sequence
estimated_arrival
created_at
```

Stop types:

```text
PICKUP
STOP
DROPOFF
```

## 14. Passenger Information

For MVP, passenger data can live on the booking:

```text
passenger_name
passenger_phone
passenger_email
```

Remember:

```text
Customer = person making/paying for the booking
Passenger = person actually riding
```

## 15. Booking Status

Recommended statuses:

```text
PENDING_PAYMENT
CONFIRMED
DRIVER_ASSIGNMENT_PENDING
DRIVER_ASSIGNED
DRIVER_EN_ROUTE
DRIVER_ARRIVED
IN_PROGRESS
COMPLETED
CANCELLED
NO_SHOW
```

## 16. Valid State Flow

```text
PENDING_PAYMENT
        ↓
CONFIRMED
        ↓
DRIVER_ASSIGNMENT_PENDING
        ↓
DRIVER_ASSIGNED
        ↓
DRIVER_EN_ROUTE
        ↓
DRIVER_ARRIVED
        ↓
IN_PROGRESS
        ↓
COMPLETED
```

Side states:

```text
CANCELLED
NO_SHOW
PAYMENT_FAILED
```

## 17. State Transition Rules

Do not allow random status updates.

Create explicit backend actions:

```text
assign driver
driver en route
driver arrived
start ride
complete ride
cancel booking
```

The backend validates the current status before allowing the next one.

## 18. Booking Status History

Use `booking_status_history`.

Fields:

```text
id
booking_id
old_status
new_status
changed_by_user_id
reason
created_at
```

## 19. Payment Workflow

```text
Create Booking
      ↓
PENDING_PAYMENT
      ↓
Create payment intent
      ↓
Payment provider
      ↓
Webhook received
      ↓
Backend validates payment
      ↓
CONFIRMED
```

Do not trust the frontend to confirm payment.

## 20. Payments Table

Recommended fields:

```text
id
booking_id
provider
provider_payment_id
amount
currency
status
paid_at
failed_at
refunded_at
created_at
updated_at
```

Statuses:

```text
PENDING
AUTHORIZED
PAID
FAILED
REFUNDED
PARTIALLY_REFUNDED
```

## 21. Driver Assignment Start

Start driver assignment after payment/booking confirmation.

```text
Payment confirmed
        ↓
Booking CONFIRMED
        ↓
Driver assignment begins
```

## 22. Driver Matching

Eligible driver requirements:

```text
driver.status = ACTIVE
driver.verification = APPROVED
vehicle.status = APPROVED
vehicle.category = required category
documents valid
driver not suspended
```

## 23. Scheduled vs Immediate Bookings

For chauffeur services, scheduled bookings matter more than current online status.

The key question is:

```text
Is the driver free during the booking time?
```

Do not only check whether the driver is `AVAILABLE` right now.

## 24. Driver Schedule Conflict

Example:

```text
Booking A
10:00 → estimated 11:00
```

Another booking at `10:30` must not be assigned.

Use buffer time too, for example:

```text
estimated end + 30 minute buffer
```

## 25. Driver Availability Blocks

Later, add `driver_schedule` to support:

```text
working hours
manual unavailable periods
assigned booking periods
time off
```

For MVP, calculate conflicts from booking assignments.

## 26. Booking Assignment Table

Use `booking_assignments`.

Fields:

```text
id
booking_id
driver_id
vehicle_id
status
assigned_by
assigned_at
accepted_at
rejected_at
rejection_reason
created_at
updated_at
```

Statuses:

```text
ASSIGNED
ACCEPTED
REJECTED
CANCELLED
COMPLETED
```

## 27. Assignment Strategy

### MVP
Use manual admin dispatch:

```text
Admin sees booking
↓
Admin selects driver
↓
Driver receives assignment
```

### Later
Automatic matching:

```text
System finds eligible drivers
↓
Ranks them
↓
Assigns one
```

## 28. Assignment Validation

Before assigning, validate:

```text
Driver eligible?
Vehicle approved?
Correct vehicle category?
No schedule conflict?
Documents valid?
```

If any validation fails, reject the assignment server-side.

## 29. Driver Accept / Reject

If accepted:

```text
assignment = ACCEPTED
booking = DRIVER_ASSIGNED
```

If rejected:

```text
assignment = REJECTED
booking = DRIVER_ASSIGNMENT_PENDING
```

Then assign another driver.

## 30. Reassignment

Do not overwrite old assignments.

Example:

```text
Driver A
REJECTED
```

Create a new assignment:

```text
Driver B
ASSIGNED
```

## 31. Ride Execution

### Driver starts journey to pickup
```text
DRIVER_EN_ROUTE
```

Store:
```text
en_route_at
```

### Driver arrives
```text
DRIVER_ARRIVED
```

Store:
```text
arrived_at
```

### Passenger boards
```text
IN_PROGRESS
```

Store:
```text
started_at
```

### Ride completes
```text
COMPLETED
```

Store:
```text
completed_at
```

## 32. Ride Table

Recommended once the system grows:

```text
rides
```

Fields:

```text
id
booking_id
driver_id
vehicle_id
en_route_at
arrived_at
started_at
completed_at
actual_distance
actual_duration
status
```

Conceptually:

```text
Booking = commercial agreement
Ride = actual execution
```

## 33. Driver Availability During Ride

When ride starts:

```text
driver.availability_status = BUSY
```

When ride completes:

```text
BUSY → AVAILABLE
```

For future scheduling, always use booking assignment conflict checks too.

## 34. Cancellation System

```text
Customer requests cancellation
        ↓
Check cancellation policy
        ↓
Calculate cancellation fee
        ↓
Refund if applicable
        ↓
Booking CANCELLED
        ↓
Release driver
```

Store:

```text
cancelled_by
cancelled_at
cancellation_reason
cancellation_fee
```

Possible actors:

```text
CUSTOMER
DRIVER
ADMIN
SYSTEM
```

## 35. Cancellation Policy

Keep it configurable.

Example:

```text
More than 24h:
Full refund

6–24h:
80% refund

Under 6h:
No refund
```

## 36. No-show Handling

Allow no-show only after:

```text
DRIVER_ARRIVED
```

Optionally enforce:

```text
arrived_at + 15 minutes
```

before no-show can be submitted.

## 37. Airport Bookings

Support:

```text
flight_number
terminal
meet_and_greet
pickup_sign_name
```

Flight tracking can be added later.

## 38. Waiting Time

Support:

```text
included_waiting_minutes
actual_waiting_minutes
extra_waiting_charge
```

## 39. Notifications

Emit events such as:

```text
BOOKING_CONFIRMED
DRIVER_ASSIGNED
DRIVER_ACCEPTED
DRIVER_EN_ROUTE
DRIVER_ARRIVED
RIDE_STARTED
RIDE_COMPLETED
BOOKING_CANCELLED
```

Then let a notification service handle:

```text
email
SMS
push
in-app
```

Recommended:

```text
Booking Service
      ↓
Event
      ↓
Notification Service
```

## 40. Suggested Service Structure

```text
BookingController
        ↓
BookingService
        │
        ├── QuoteService
        ├── PricingService
        ├── RouteService
        ├── PaymentService
        ├── DriverAssignmentService
        ├── RideService
        └── NotificationService
```

## 41. Route Service

`RouteService` handles Google Maps.

Example:

```text
calculateRoute({
    pickup,
    destination,
    stops
})
```

Returns:

```json
{
  "distanceMeters": 28410,
  "durationSeconds": 2520,
  "encodedPolyline": "...",
  "routeData": {}
}
```

Pricing then uses this result.

## 42. Quote Service

`QuoteService.createQuote()` should:

```text
Validate locations
        ↓
Calculate Google route
        ↓
Find vehicle categories
        ↓
Calculate price for each
        ↓
Save quote
        ↓
Return vehicle options
```

## 43. Booking Service

`BookingService.createFromQuote()` should:

```text
Validate quote exists
↓
Validate quote not expired
↓
Validate selected vehicle category
↓
Copy quote snapshot
↓
Create booking
↓
Set PENDING_PAYMENT
```

Use a transaction where appropriate.

## 44. Payment Service

Responsibilities:

```text
create payment
verify webhook
mark payment successful
handle failure
refund
```

On successful payment:

```text
payment = PAID
booking = CONFIRMED
```

Then trigger driver assignment.

## 45. Driver Assignment Service

Responsibilities:

```text
find eligible drivers
check conflicts
assign driver
handle acceptance
handle rejection
reassign
```

## 46. Ride Service

Responsibilities:

```text
enRoute()
arrived()
start()
complete()
noShow()
```

Each action validates the current booking state.

## 47. State Transition Helper

Centralize allowed transitions.

```ts
const allowedTransitions = {
  CONFIRMED: ["DRIVER_ASSIGNMENT_PENDING", "CANCELLED"],
  DRIVER_ASSIGNMENT_PENDING: ["DRIVER_ASSIGNED", "CANCELLED"],
  DRIVER_ASSIGNED: ["DRIVER_EN_ROUTE", "CANCELLED"],
  DRIVER_EN_ROUTE: ["DRIVER_ARRIVED", "CANCELLED"],
  DRIVER_ARRIVED: ["IN_PROGRESS", "NO_SHOW", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED"],
};
```

Controllers should never directly modify booking status.

## 48. Core API Routes

### Quotes

```text
POST /quotes
GET /quotes/:id
```

### Bookings

```text
POST /bookings
GET /bookings/:id
GET /bookings/me
```

### Payments

```text
POST /bookings/:id/payment
POST /payments/webhook
```

### Admin Dispatch

```text
GET /admin/bookings/unassigned
GET /admin/bookings/:id/eligible-drivers
POST /admin/bookings/:id/assign
POST /admin/bookings/:id/reassign
```

### Driver

```text
GET /driver/bookings/upcoming
GET /driver/bookings/:id

POST /driver/bookings/:id/accept
POST /driver/bookings/:id/reject
POST /driver/bookings/:id/en-route
POST /driver/bookings/:id/arrived
POST /driver/bookings/:id/start
POST /driver/bookings/:id/complete
POST /driver/bookings/:id/no-show
```

## 49. Main SQL Tables

Recommended:

```text
users
drivers
vehicles
vehicle_types
quotes
quote_vehicle_options
bookings
booking_stops
payments
booking_assignments
booking_status_history
rides
```

Optional later:

```text
pricing_rules
booking_extras
booking_cancellations
driver_schedules
notifications
discount_codes
```

## 50. Quote Vehicle Options

Use:

```text
quote_vehicle_options
```

Fields:

```text
id
quote_id
vehicle_type_id
base_price
surcharges
discount
tax
total_price
```

This lets frontend show:

```text
Standard    £42
Executive   £58
Luxury      £91
```

## 51. Concurrency Protection

Protect against two admins assigning the same driver to overlapping bookings.

At minimum:

```text
BEGIN

check schedule
check driver eligibility
create assignment

COMMIT
```

Recheck conflicts inside the transaction.

## 52. Idempotency

Critical for:

```text
payments
booking creation
ride actions
webhooks
```

If a payment webhook arrives twice, do not create duplicates.

Use provider event IDs or idempotency keys.

## 53. Scheduled Jobs

Possible background jobs:

### Booking reminders

```text
24 hours before → send reminder
2 hours before → verify driver assignment
30 minutes before → notify driver
```

### Document expiry

```text
daily
```

### Stale payments

```text
payment pending too long
→ expire booking
```

## 54. Error Cases

Handle:

```text
Google route failure
quote expired
payment fails
payment succeeds but customer closes browser
no eligible driver exists
assigned driver rejects
assigned vehicle becomes unavailable
customer cancels
driver cancels
driver does not arrive
passenger no-show
ride starts twice
ride completes twice
admin tries double assignment
document expires before journey
vehicle gets suspended after assignment
```

## 55. Recommended MVP Build Order

```text
1. Vehicle Types
2. Google Route Service
3. Pricing / Quote Engine
4. Quote storage
5. Booking creation
6. Payment flow
7. Booking state machine
8. Admin manual driver assignment
9. Driver accept/reject
10. Ride lifecycle
11. Cancellation
12. Status history
13. Notifications
```

Later add:

```text
automatic driver matching
hourly bookings
return bookings
multi-stop bookings
advanced pricing rules
live tracking
flight tracking
automatic dispatch
```

## 56. Complete Engine Flow

```text
                 CUSTOMER
                    │
                    ▼
          Pickup + Destination
                    │
                    ▼
              GOOGLE MAPS
                    │
             Route / Distance
                    │
                    ▼
             PRICING ENGINE
                    │
                    ▼
                  QUOTE
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
     Standard    Executive    Luxury
        │
        └───────────┬───────────┘
                    ▼
            CUSTOMER SELECTS
                    │
                    ▼
                 BOOKING
                    │
            PENDING_PAYMENT
                    │
                    ▼
                PAYMENT
                    │
                    ▼
               CONFIRMED
                    │
                    ▼
          DRIVER ASSIGNMENT
                    │
              ┌─────┴─────┐
              ▼           ▼
           ACCEPT       REJECT
              │           │
              │       REASSIGN
              │
              ▼
        DRIVER ASSIGNED
              │
              ▼
        DRIVER EN ROUTE
              │
              ▼
        DRIVER ARRIVED
              │
              ▼
          RIDE START
              │
              ▼
          IN PROGRESS
              │
              ▼
           COMPLETE
              │
              ▼
      BOOKING COMPLETED
```

## 57. Architectural Rule

Do not make the `bookings` table, controller, or service responsible for everything.

Keep these separate:

```text
routing
quoting
pricing
booking
payment
assignment
ride execution
notifications
```

They should communicate through controlled state changes.

This keeps the system maintainable as you later add:

```text
return journeys
hourly hire
multi-stop bookings
airport pickups
advanced pricing
driver schedules
live tracking
automatic dispatch
corporate accounts
```
