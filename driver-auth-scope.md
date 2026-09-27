# Driver Module Scope

## 1. Overview

The Driver Module is responsible for everything related to chauffeur onboarding, verification, vehicle verification, availability, assigned bookings, ride execution, and driver-side account management.

The system uses:

- SQL database
- Drizzle ORM
- Role-based authentication
- Google Maps for route/location information
- One Driver = One Vehicle
- Admin approval before a driver can accept bookings

The driver module must remain separated from customer booking logic where possible.

---

# 2. Driver Roles and Access

The main user roles are:

- CUSTOMER
- DRIVER
- ADMIN

A DRIVER user can only access driver-specific routes and data.

A driver must never be able to:

- access another driver's profile
- access another driver's bookings
- approve themselves
- approve their vehicle
- modify verification status
- assign bookings to themselves manually
- change booking price
- modify another user's information

All driver APIs must validate the authenticated user.

---

# 3. Driver Registration

## Registration Fields

The initial driver registration should collect:

- first name
- last name
- email
- phone number
- password
- confirm password

On registration:

1. Create a `users` record.
2. Set:

```text
role = DRIVER
```

3. Create the driver's `drivers` record.
4. Default values:

```text
status = PENDING
verification_status = PENDING
availability_status = OFFLINE
```

The driver should not be eligible for bookings immediately after registration.

---

# 4. Authentication

Driver authentication should support:

- login using email + password
- logout
- forgot password
- reset password
- email verification
- phone verification if implemented
- refresh token/session handling

Passwords must always be hashed.

Never store plain-text passwords.

Recommended password hashing:

```text
Argon2
```

or:

```text
bcrypt
```

---

# 5. Driver Profile

After registering, the driver must complete their profile.

## Required Driver Profile Fields

```text
first_name
last_name
phone
email
date_of_birth
profile_image
address
city
years_of_experience
```

Optional:

```text
emergency_contact_name
emergency_contact_phone
languages
```

The driver's email and phone should belong to the `users` table.

Driver-specific profile information belongs to the `drivers` table.

---

# 6. Driver Profile Status

Driver status can be:

```text
PENDING
ACTIVE
SUSPENDED
REJECTED
INACTIVE
```

### PENDING

Driver has registered but onboarding or verification is incomplete.

### ACTIVE

Driver has successfully completed verification and can potentially receive bookings.

### SUSPENDED

Admin has temporarily disabled the driver.

A suspended driver cannot:

- become available
- receive bookings
- start new rides

### REJECTED

Driver application has been rejected.

### INACTIVE

Driver account is not currently operating.

---

# 7. Driver Verification

Driver verification is separate from driver account creation.

The driver must upload required documents.

Possible documents:

```text
DRIVING_LICENSE
IDENTITY_DOCUMENT
BACKGROUND_CHECK
WORK_PERMIT
OTHER
```

Each document should contain:

```text
driver_id
document_type
document_number
front_image_url
back_image_url
issue_date
expiry_date
status
verified_by
verified_at
rejection_reason
```

Document status:

```text
PENDING
APPROVED
REJECTED
EXPIRED
```

---

# 8. Driver Verification Flow

The flow should be:

```text
Driver registers
        ↓
Completes profile
        ↓
Uploads required documents
        ↓
Driver verification = UNDER_REVIEW
        ↓
Admin reviews documents
        ↓
 ┌──────────────┴──────────────┐
 ↓                             ↓
APPROVED                    REJECTED
```

If approved:

```text
verification_status = APPROVED
```

If rejected:

```text
verification_status = REJECTED
```

The rejection reason must be shown to the driver.

---

# 9. Vehicle Registration

Each driver can have only ONE vehicle.

Database rule:

```text
Driver 1:1 Vehicle
```

The `vehicles.driver_id` column must be unique.

The driver should provide:

```text
make
model
year
color
registration_number
vin_number
vehicle_category
passenger_capacity
luggage_capacity
```

Possible vehicle categories:

```text
STANDARD
EXECUTIVE
LUXURY
SUV
VAN
```

Vehicle starts with:

```text
status = PENDING
```

---

# 10. Vehicle Photos

Driver must upload vehicle photos.

Required photo types:

```text
FRONT
BACK
LEFT
RIGHT
INTERIOR
LICENSE_PLATE
```

Recommended rule:

One current photo for each photo type.

Example:

```text
vehicle_id + photo_type = UNIQUE
```

Vehicle photos should have:

```text
vehicle_id
photo_type
image_url
status
rejection_reason
```

Status:

```text
PENDING
APPROVED
REJECTED
```

---

# 11. Vehicle Documents

Driver must upload the required vehicle documentation.

Possible vehicle document types:

```text
REGISTRATION
INSURANCE
INSPECTION_CERTIFICATE
COMMERCIAL_LICENSE
OTHER
```

Each document contains:

```text
vehicle_id
document_type
document_number
file_url
issue_date
expiry_date
status
verified_by
verified_at
rejection_reason
```

Document statuses:

```text
PENDING
APPROVED
REJECTED
EXPIRED
```

---

# 12. Vehicle Verification

Vehicle verification must remain independent from driver verification.

Flow:

```text
Driver submits vehicle
        ↓
Uploads vehicle documents
        ↓
Uploads required photos
        ↓
status = UNDER_REVIEW
        ↓
Admin reviews
        ↓
 ┌────────────┴────────────┐
 ↓                         ↓
APPROVED                REJECTED
```

Vehicle statuses:

```text
PENDING
UNDER_REVIEW
APPROVED
REJECTED
SUSPENDED
```

---

# 13. Driver Eligibility

A driver is eligible to receive bookings only if all conditions are true:

```text
user.is_active = true

AND

driver.status = ACTIVE

AND

driver.verification_status = APPROVED

AND

vehicle.status = APPROVED

AND

driver.availability_status = AVAILABLE
```

Additionally:

- driver's required documents must not be expired
- vehicle documents must not be expired

This check should be handled server-side.

Never trust frontend values.

---

# 14. Driver Availability

Availability status:

```text
OFFLINE
AVAILABLE
BUSY
UNAVAILABLE
```

### OFFLINE

Driver is not currently operating.

### AVAILABLE

Driver is eligible for booking assignment.

### BUSY

Driver currently has an active ride.

### UNAVAILABLE

Driver is temporarily unavailable.

The driver should be able to toggle:

```text
OFFLINE → AVAILABLE
AVAILABLE → OFFLINE
```

The system should automatically change the driver to:

```text
BUSY
```

when an active booking starts.

After completion, the system can return the driver to:

```text
AVAILABLE
```

if appropriate.

---

# 15. Availability Validation

Before allowing:

```text
availability_status = AVAILABLE
```

validate:

```text
driver approved
vehicle approved
required driver documents valid
required vehicle documents valid
account active
not suspended
```

If one fails:

```text
Cannot go online
```

Return the exact reason.

Example:

```text
Your vehicle insurance has expired.
```

---

# 16. Driver Dashboard

Driver dashboard should display:

## Profile

- driver name
- profile photo
- verification state

## Vehicle

- make
- model
- registration
- approval status

## Availability

```text
ONLINE / OFFLINE
```

## Booking Information

- active booking
- next upcoming booking
- recent completed bookings

Optional statistics later:

```text
today's trips
weekly trips
completed trips
cancelled trips
earnings
```

Earnings can remain outside the first version if payment settlement to drivers is not yet required.

---

# 17. Driver Booking Assignment

Drivers should not browse every booking.

Bookings should be assigned through backend/admin dispatch logic.

Basic relationship:

```text
Booking
   ↓
Booking Assignment
   ↓
Driver
```

A booking assignment should record:

```text
booking_id
driver_id
vehicle_id
assigned_by
assigned_at
status
accepted_at
rejected_at
rejection_reason
```

---

# 18. Booking Assignment Status

Possible statuses:

```text
ASSIGNED
ACCEPTED
REJECTED
CANCELLED
COMPLETED
```

When booking assigned:

```text
ASSIGNED
```

Driver sees:

```text
New Booking
```

with important ride details.

---

# 19. Driver Booking Details

Driver should be able to see:

```text
booking reference
pickup address
drop-off address
pickup coordinates
drop-off coordinates
scheduled date
scheduled time
passenger name
passenger phone
passenger count
luggage
special instructions
flight details
booking type
route distance
estimated duration
```

Do not expose sensitive customer information unrelated to the ride.

---

# 20. Google Maps Integration

For an assigned booking, Google Maps information should already exist from the customer booking process.

Store:

```text
pickup_place_id
pickup_address
pickup_latitude
pickup_longitude

dropoff_place_id
dropoff_address
dropoff_latitude
dropoff_longitude
```

Driver should be able to open navigation.

Navigation URL can be generated from coordinates.

Example flow:

```text
Driver clicks Navigate
        ↓
Open Google Maps
        ↓
Navigate to pickup
```

After pickup:

```text
Navigate to destination
```

---

# 21. Ride Lifecycle

Driver should control ride operational states.

Recommended flow:

```text
ASSIGNED
    ↓
ACCEPTED
    ↓
DRIVER_EN_ROUTE
    ↓
DRIVER_ARRIVED
    ↓
PASSENGER_ONBOARD
    ↓
IN_PROGRESS
    ↓
COMPLETED
```

Alternative/side states:

```text
DRIVER_REJECTED
CUSTOMER_CANCELLED
ADMIN_CANCELLED
NO_SHOW
```

---

# 22. Driver Accept Booking

Driver receives booking.

Actions:

```text
ACCEPT
REJECT
```

If accepted:

```text
assignment.status = ACCEPTED
```

If rejected:

```text
assignment.status = REJECTED
```

Optionally require a rejection reason.

Possible reasons:

```text
UNAVAILABLE
TOO_FAR
VEHICLE_ISSUE
EMERGENCY
OTHER
```

---

# 23. Start Driving to Customer

Driver action:

```text
START JOURNEY TO PICKUP
```

Changes ride status:

```text
DRIVER_EN_ROUTE
```

The customer can then be notified:

```text
Your chauffeur is on the way.
```

---

# 24. Driver Arrived

Driver clicks:

```text
ARRIVED
```

Status:

```text
DRIVER_ARRIVED
```

Store timestamp:

```text
arrived_at
```

Customer receives notification.

---

# 25. Passenger Pickup

Once passenger enters vehicle:

```text
START RIDE
```

The backend should update:

```text
PASSENGER_ONBOARD
```

and then:

```text
IN_PROGRESS
```

Depending on how detailed the state machine becomes, these may be separate actions.

Store:

```text
started_at
```

---

# 26. Ride Completion

When destination is reached:

Driver selects:

```text
COMPLETE RIDE
```

System validates:

```text
current status = IN_PROGRESS
```

Then sets:

```text
status = COMPLETED
completed_at = current timestamp
```

Driver:

```text
availability_status = AVAILABLE
```

unless:

- manually offline
- suspended
- another ride already scheduled requiring another state
- documents became invalid

---

# 27. Customer No-Show

Driver should have:

```text
REPORT NO SHOW
```

But this should not become immediately final.

Recommended logic:

```text
Driver arrives
        ↓
Waiting period
        ↓
Driver reports NO_SHOW
        ↓
Backend/Admin validation
        ↓
Booking = NO_SHOW
```

Store:

```text
reported_at
reason
driver_notes
```

---

# 28. Driver Cancellation

Drivers should not casually cancel confirmed rides.

If cancellation is allowed:

Require:

```text
cancellation_reason
```

Possible reasons:

```text
VEHICLE_BREAKDOWN
EMERGENCY
ACCIDENT
ILLNESS
OTHER
```

Notify admin immediately so another driver can be assigned.

---

# 29. Upcoming Bookings

Driver should have:

```text
Upcoming
Active
Completed
Cancelled
```

For upcoming bookings display:

```text
pickup time
pickup address
destination
passenger
vehicle
booking reference
```

Sort:

```text
pickup_at ASC
```

---

# 30. Booking History

Driver can view their own previous bookings.

Filters:

```text
COMPLETED
CANCELLED
NO_SHOW
```

Optional filters:

```text
date range
```

Driver must never query another driver's history.

---

# 31. Notifications

Driver notifications should support events like:

```text
booking assigned
booking changed
booking cancelled
booking reassigned
vehicle approved
vehicle rejected
driver approved
driver rejected
document approved
document rejected
document expiring
document expired
```

Initially these can be:

```text
in-app
email
```

Later:

```text
push notification
SMS
```

---

# 32. Document Expiry

The backend must regularly detect expiry.

Example:

```text
license.expiry_date < today
```

Then:

```text
document.status = EXPIRED
```

If required documentation expires:

```text
driver cannot become AVAILABLE
```

Same rule applies to vehicle documents.

The driver should see:

```text
Insurance expired
Upload a new document to continue receiving bookings.
```

---

# 33. Driver Document Resubmission

If document rejected:

```text
REJECTED
```

Driver should see the rejection reason.

Example:

```text
Image is unreadable.
```

Driver uploads replacement.

Status becomes:

```text
PENDING
```

Admin reviews again.

Maintain verification history.

---

# 34. Vehicle Resubmission

If vehicle rejected:

Driver should see:

```text
vehicle.status = REJECTED
rejection_reason
```

Driver can:

- update vehicle information
- replace vehicle photos
- upload replacement documents
- resubmit

After resubmission:

```text
vehicle.status = UNDER_REVIEW
```

---

# 35. Verification History

Maintain audit history.

Record:

```text
entity_type
entity_id
old_status
new_status
reviewed_by
reason
created_at
```

Entity types:

```text
DRIVER
VEHICLE
DOCUMENT
```

Example:

```text
VEHICLE
#81

PENDING → REJECTED

Reason:
Insurance certificate expired.

Reviewed by:
Admin #2
```

---

# 36. Driver Profile Editing

Driver should be allowed to edit:

```text
profile photo
phone
address
city
emergency contact
languages
```

Sensitive fields should require additional handling.

Examples:

```text
email
legal name
date of birth
```

Changing important verified identity details may require re-verification.

---

# 37. Vehicle Editing

After vehicle approval, the driver should not freely change important vehicle identity fields without review.

Important fields:

```text
registration_number
VIN
make
model
year
```

If these change:

```text
vehicle.status = PENDING
```

or:

```text
UNDER_REVIEW
```

because effectively the vehicle identity has changed.

Minor information such as certain optional metadata may remain editable.

---

# 38. Driver Account Suspension

Admin can suspend driver.

When suspended:

```text
driver.status = SUSPENDED
availability_status = OFFLINE
```

Driver cannot:

- receive new bookings
- become available
- accept new assignments

Existing active booking should trigger admin intervention rather than silently disappearing.

---

# 39. Driver Deactivation

Driver may request account deactivation.

Instead of deleting historical records:

```text
status = INACTIVE
user.is_active = false
```

Booking history must remain preserved.

Avoid hard deletion where operational history matters.

---

# 40. Database Tables Required

Current Driver Module:

```text
users

drivers

driver_documents

vehicles

vehicle_documents

vehicle_photos

verification_history
```

Booking integration will later require:

```text
bookings

booking_assignments

booking_status_history
```

Potential future tables:

```text
driver_locations

driver_earnings

driver_payouts

driver_notifications

driver_ratings

driver_schedule
```

Do not build these until required.

---

# 41. Recommended Driver APIs

## Authentication

```text
POST /auth/driver/register

POST /auth/login

POST /auth/logout

POST /auth/forgot-password

POST /auth/reset-password

POST /auth/verify-email
```

---

## Driver Profile

```text
GET /driver/me

PATCH /driver/me
```

---

## Driver Documents

```text
GET /driver/documents

POST /driver/documents

PATCH /driver/documents/:documentId

DELETE /driver/documents/:documentId
```

Deletion should only be allowed where business rules permit.

---

## Vehicle

```text
GET /driver/vehicle

POST /driver/vehicle

PATCH /driver/vehicle
```

Since one driver has one vehicle, there is no need for:

```text
GET /driver/vehicles/:id
```

unless future requirements change.

---

## Vehicle Documents

```text
GET /driver/vehicle/documents

POST /driver/vehicle/documents

PATCH /driver/vehicle/documents/:documentId
```

---

## Vehicle Photos

```text
GET /driver/vehicle/photos

POST /driver/vehicle/photos

PATCH /driver/vehicle/photos/:photoId
```

---

## Availability

```text
GET /driver/availability

PATCH /driver/availability
```

Example:

```json
{
  "status": "AVAILABLE"
}
```

Backend must verify driver eligibility before allowing this.

---

## Driver Bookings

```text
GET /driver/bookings/upcoming

GET /driver/bookings/active

GET /driver/bookings/history

GET /driver/bookings/:bookingId
```

All queries must ensure:

```text
booking is assigned to authenticated driver
```

---

## Booking Actions

```text
POST /driver/bookings/:bookingId/accept

POST /driver/bookings/:bookingId/reject

POST /driver/bookings/:bookingId/en-route

POST /driver/bookings/:bookingId/arrived

POST /driver/bookings/:bookingId/start

POST /driver/bookings/:bookingId/complete

POST /driver/bookings/:bookingId/no-show
```

---

# 42. Admin Driver APIs

Admin should have:

```text
GET /admin/drivers

GET /admin/drivers/:driverId

POST /admin/drivers/:driverId/approve

POST /admin/drivers/:driverId/reject

POST /admin/drivers/:driverId/suspend

POST /admin/drivers/:driverId/activate
```

---

## Driver Document Approval

```text
POST /admin/driver-documents/:id/approve

POST /admin/driver-documents/:id/reject
```

---

## Vehicle Approval

```text
POST /admin/vehicles/:vehicleId/approve

POST /admin/vehicles/:vehicleId/reject

POST /admin/vehicles/:vehicleId/suspend
```

---

## Vehicle Document Approval

```text
POST /admin/vehicle-documents/:id/approve

POST /admin/vehicle-documents/:id/reject
```

---

# 43. Permissions

## Driver

Can:

```text
manage own profile
upload own documents
manage own vehicle
upload vehicle documents
upload vehicle photos
view own verification status
toggle own availability
view assigned bookings
perform ride actions
```

Cannot:

```text
approve verification
assign bookings
modify fare
modify another driver
view unrelated bookings
modify admin-only statuses
```

---

## Admin

Can:

```text
review drivers
approve/reject drivers
review documents
approve/reject vehicles
suspend drivers
view driver booking history
assign/reassign bookings
```

---

# 44. Critical Backend Rules

Never accept these directly from driver requests:

```text
verification_status
verified_by
verified_at
vehicle.status
driver.status = ACTIVE
booking price
assigned_driver
```

These must be controlled by trusted backend/admin logic.

---

# 45. File Uploads

Images/documents should not be stored directly inside the SQL database.

Store files in:

```text
S3
Cloudinary
Supabase Storage
Cloudflare R2
or similar
```

SQL stores only:

```text
file_url
image_url
metadata
```

Validate:

```text
file size
file MIME type
extension
upload authorization
```

---

# 46. Security

All driver endpoints require authentication.

Use authorization middleware:

```text
requireAuth
requireRole("DRIVER")
```

Admin endpoints:

```text
requireAuth
requireRole("ADMIN")
```

Never rely only on hidden frontend buttons for permission control.

---

# 47. Data Validation

Validate inputs server-side.

Examples:

```text
year must be sensible
passenger_capacity > 0
luggage_capacity >= 0
experience >= 0
expiry_date > issue_date
DOB must be valid
email must be valid
phone must be valid
```

Registration number and VIN should be normalized before comparison.

---

# 48. Transactions

Use SQL transactions when multiple related records must change together.

Example:

Driver approval:

```text
Approve required documents
        +
Update driver verification
        +
Create verification history
```

These operations should be transactional where appropriate.

Same for booking lifecycle updates that change:

```text
booking
assignment
driver availability
status history
```

---

# 49. Expected Driver Onboarding UX

```text
Create Account
      ↓
Verify Email
      ↓
Complete Profile
      ↓
Upload Driver Documents
      ↓
Add Vehicle
      ↓
Upload Vehicle Documents
      ↓
Upload Vehicle Photos
      ↓
Submit For Review
      ↓
Admin Review
      ↓
Approved
      ↓
Driver Can Go Online
      ↓
Receive Bookings
```

---

# 50. MVP Scope

For the first working Driver Module, implement:

### Authentication

- Driver registration
- Login
- logout
- password reset

### Profile

- Driver profile
- profile editing

### Verification

- driver document upload
- document status
- admin approval/rejection

### Vehicle

- create one vehicle
- edit vehicle
- upload documents
- upload photos
- admin approval/rejection

### Availability

- available/offline toggle
- backend eligibility check

### Booking Integration

- assigned bookings
- upcoming bookings
- accept/reject
- en route
- arrived
- start
- complete
- booking history

Do not implement advanced features such as earnings, live GPS tracking, ratings, payouts, driver scheduling, or automated dispatch until the base lifecycle is stable.

---

# 51. Final Driver Lifecycle

```text
USER REGISTERED
        ↓
DRIVER PROFILE CREATED
        ↓
PROFILE COMPLETED
        ↓
DOCUMENTS SUBMITTED
        ↓
DRIVER APPROVED
        ↓
VEHICLE SUBMITTED
        ↓
VEHICLE APPROVED
        ↓
DRIVER ACTIVE
        ↓
DRIVER GOES AVAILABLE
        ↓
BOOKING ASSIGNED
        ↓
DRIVER ACCEPTS
        ↓
EN ROUTE
        ↓
ARRIVED
        ↓
RIDE STARTED
        ↓
RIDE COMPLETED
        ↓
DRIVER AVAILABLE AGAIN
```

The backend must always remain the source of truth for:

```text
verification
availability eligibility
booking assignment
ride status transitions
vehicle approval
driver approval
```

Frontend should only request allowed actions and display the resulting server state.