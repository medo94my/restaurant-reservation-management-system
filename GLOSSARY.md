# Domain Glossary: Saffron & Cedar Dining Room

## Core Domain Concepts

### Dining Service
The live operating session for a service shift. Coordinates real-time dining room state: active floor units, reservations, guest arrivals, preparation alerts, and shift financials (covers and revenue).

### Unit
A physical floor asset in the dining room with spatial coordinates, rotation, capacity, and a service status (`available`, `seated`, `prep`, `blocked`). Concrete kinds include:
- **Table**: Standard dining table (`round`, `square`, `rectangle`, `oval`, `long`).
- **Couch**: Lounge seating unit (`loveseat`, `sofa`, `l-sectional`, `banquette`).
- **Room**: Enclosed private dining area with interior table furniture.

### Booking
A guest reservation for a dining service shift, specifying party size (pax), preferred seating kind or shape, target arrival time, guest contact details, special preferences, and assigned unit.

### Check Closeout
The transition that concludes a seated dining party at a unit. Clears the table back to `available`, records total spend for shift revenue calculations, and increments the guest's cumulative visit count.

### Prep Alert
A time-sensitive threshold trigger calculated against the service clock (typically 15–30 minutes before booking arrival) prompting front-of-house staff to prepare the assigned unit.

### Guest Profile
Persistent dining CRM record keyed by normalized phone number, tracking guest name, visit count, dietary/seating preferences, and assigned occasion tags.

### Visit Tier
A loyalty classification threshold (e.g., `New`, `Regular`, `Loyal`) dynamically resolved from a guest's cumulative visits against configurable minimums.

### Occasion Tag
Descriptive metadata chip (e.g., `VIP`, `Birthday`, `Anniversary`) associated with guest profiles or specific bookings.

### Workspace Sync Adapter
The adapter function fulfilling the persistence seam for the Dining Service module, transferring updated floor configurations and customer records to storage (e.g., PostgreSQL via Next.js API in production, or in-memory array in unit tests).

### Workspace Configuration Store
The deep persistence module governing workspace configuration snapshots (floor layout, customer profiles, visit tiers, occasion tags), encapsulating schema validation invariants, legacy layout migrations, and role-based data masking.

### Floor Layout Engine
The spatial geometry and unit allocation module responsible for canvas coordinate bounds, sequential unit identification, seat positions, and party-to-unit sizing rules.
