# Fundamentals

Arkiv is a universal data layer that brings queryable, time-scoped storage to Ethereum. Store, query, and manage data with built-in expiration and attribute systems.

## Why Arkiv?
**Instant Queries**
SQL-like queries with attributes, indexed data retrieval, no external indexing required.

**Cost-Efficient**
Pay only for storage duration. Automatic data pruning — no permanent storage fees.

**Ethereum-Native**
Built on Ethereum infrastructure. Fully transparent, tamper-proof, and compatible with existing Web3 tools.

**Developer-Friendly**
Simple CRUD operations and a TypeScript SDK with full type safety.

## Architecture

Arkiv uses a three-layer architecture:

```
┌─────────────────────────────────────────────────────┐
│  YOUR APP                                           │
│  TypeScript SDK  ·  JSON-RPC                        │
└────────────────────────┬────────────────────────────┘
                         │  read / write
                         ▼
┌─────────────────────────────────────────────────────┐
│  LAYER 3 — DB-CHAINS                                │
│  High-performance CRUD, indexed queries,            │
│  programmable expiration                            │
└────────────────────────┬────────────────────────────┘
                         │  coordination
                         ▼
┌─────────────────────────────────────────────────────┐
│  LAYER 2 — ARKIV COORDINATION LAYER                 │
│  DB-chain registry,                                 │
│  deterministic query resolution                     │
└────────────────────────┬────────────────────────────┘
                         │  settlement
                         ▼
┌─────────────────────────────────────────────────────┐
│  LAYER 1 — ETHEREUM MAINNET                         │
│  Proof verification, commitments,                   │
│  ultimate source of truth                           │
└─────────────────────────────────────────────────────┘
```

## Core Concepts

### Entities

An entity is a data record on Arkiv. Every entity contains:

- **Payload** — The actual data (JSON, text, binary)
- **Attributes** — Key-value pairs for querying (string or numeric)
- **ExpiresIn** — Automatic expiration measured in seconds
- **Content Type** — MIME type of the payload

### Attributes

Attributes are the backbone of querying. The type you choose determines what query operators are available:

```ts
// String attributes — support eq(), glob matching (~)
{ key: 'type', value: 'note' }
{ key: 'status', value: 'active' }

// Numeric attributes — support eq(), gt(), lt(), gte(), lte() range queries
{ key: 'priority', value: 5 }
{ key: 'created', value: Date.now() }
```
**Caution:** If you store a number as a string (`{ key: 'priority', value: '5' }`), you lose the ability to do range queries with `gt()`, `lt()`, etc. Always use numeric values for attributes you plan to filter by range.

### ExpiresIn

Every entity has a lifespan expressed in **seconds**. Use the `ExpirationTime` helper to convert human-readable durations:

```ts
import { ExpirationTime } from "@arkiv-network/sdk/utils";

ExpirationTime.fromMinutes(30)  // 1800 seconds
ExpirationTime.fromHours(1)     // 3600 seconds
ExpirationTime.fromHours(12)    // 43200 seconds
ExpirationTime.fromDays(7)      // 604800 seconds
```
**Note:** Entities can be extended before they expire using `extendEntity()`. Over-allocating expiration wastes storage fees — start short and extend if needed.

### Query Language

SQL-like syntax for filtering entities:

```sql
type = "note" && priority > 3 && created > 1672531200
```

Supported operators: `&&` (AND), `||` (OR), `!` (NOT), `=`, `!=`, `<`, `>`, `<=`, `>=`, `~` (glob match).

### Clients

Two client types exist:

1. **WalletClient** (read/write) — Requires a private key or wallet connection. Use for creating, updating, deleting entities.
2. **PublicClient** (read-only) — No private key needed. Use for queries. Safe for frontend use.

## What You Can Query

The SDK's query builder supports more than basic filtering. Before you reach for client-side sorting or manual pagination, check what's built in:

- **Ordering** — sort results by any numeric attribute with `orderBy(desc('field', 'number'))`
- **Pagination** — cursor-based, up to 200 results per page with `hasNextPage()` / `next()`
- **Entity count** — get a count without fetching entities via `getEntityCount()`
- **Owner & creator filters** — `.ownedBy()` and `.createdBy()` for wallet-level filtering

Full reference: [Querying Data](https://docs.arkiv.network/typescript-sdk/querying-data/)

## Use Cases

- **Temporary Data Storage** — Session data with automatic expiration, cross-device clipboards, cached API responses.
- **Event & Analytics** — Application logs with cleanup, user activity tracking, temporary metrics.
- **File & Media** — Image metadata with expiration, document versioning, chunked file storage.
- **Full-Stack Applications** — Dashboards, collaborative tools, browser-based dApps with wallet signing.

# Installation

Arkiv provides an official TypeScript/JavaScript SDK — [`@arkiv-network/sdk`](https://www.npmjs.com/package/@arkiv-network/sdk) — that works in Node.js, Bun, and the browser. It handles client creation, queries, mutations, event subscriptions, and payload encoding.

## Install the SDK

```bash
    npm install @arkiv-network/sdk
    ```
  ```bash
    bun add @arkiv-network/sdk
    ```
  ## Client Setup

### WalletClient (read/write)

Requires a private key. Use for creating, updating, and deleting entities:

```ts
import { createWalletClient, http } from "@arkiv-network/sdk"
import { privateKeyToAccount } from "@arkiv-network/sdk/accounts"
import { braga } from "@arkiv-network/sdk/chains"

const walletClient = createWalletClient({
  chain: braga,
  transport: http(),
  account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
})
```
**Caution:** Keep your private key in environment variables. Never hardcode it.

### PublicClient (read-only)

No private key needed. Use for queries — safe for frontend use:

```ts
import { createPublicClient, http } from "@arkiv-network/sdk"
import { braga } from "@arkiv-network/sdk/chains"

const publicClient = createPublicClient({
  chain: braga,
  transport: http(),
})
```

## Hello, World!

1. **Create your project**

   ```bash
       mkdir hello-arkiv && cd hello-arkiv
       npm init --init-type=module -y
       npm install @arkiv-network/sdk dotenv typescript
       ```
     ```bash
       mkdir hello-arkiv && cd hello-arkiv
       bun init -y
       bun add @arkiv-network/sdk dotenv
       ```
2. **Add your private key**

   ```bash title=".env"
   PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
   ```

   Get test GLM from the [Braga faucet](https://braga.hoodi.arkiv.network/faucet/) — Braga uses GLM as its native gas token.

3. **Write your first entity**

   ```ts title="hello.ts"
   import { createWalletClient, createPublicClient, http } from '@arkiv-network/sdk';
   import { stringToPayload } from '@arkiv-network/sdk/utils';
   import { braga } from '@arkiv-network/sdk/chains';
   import { privateKeyToAccount } from '@arkiv-network/sdk/accounts';
   import { config } from 'dotenv';

   config({ path: '.env' });

   const walletClient = createWalletClient({
     chain: braga,
     transport: http(),
     account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
   });

   const publicClient = createPublicClient({
     chain: braga,
     transport: http(),
   });

   // Create an entity
   const { entityKey, txHash } = await walletClient.createEntity({
     payload: stringToPayload('Hello, Arkiv!'),
     contentType: 'text/plain',
     attributes: [{ key: 'type', value: 'greeting' }],
     expiresIn: 3600,
   });

   console.log('Entity created:', entityKey);
   console.log('Transaction:', txHash);

   // Read it back
   const entity = await publicClient.getEntity(entityKey);
   console.log('Retrieved:', entity.toText());
   ```

4. **Run it**

   ```bash
       npx tsx hello.ts
       ```
     ```bash
       bun run hello.ts
       ```
**Tip:** Most real applications store JSON data. Use `jsonToPayload` instead of `stringToPayload` for structured data — see [Mutating Data](https://docs.arkiv.network/typescript-sdk/mutating-data/#payload-helpers) for details.
**Note:** All entities in Arkiv are stored in a shared database. Tag your data with a unique project attribute so your queries only return your app's entities. See [Best Practices](https://docs.arkiv.network/typescript-sdk/best-practices/#1-always-use-a-project-attribute).

## Browser Usage (CDN)

For static HTML/JS pages without a bundler:

```js
import { createPublicClient, http } from 'https://esm.sh/@arkiv-network/sdk@0.6.0?target=es2022&bundle-deps'
import { eq } from 'https://esm.sh/@arkiv-network/sdk@0.6.0/query?target=es2022&bundle-deps'
import { braga } from 'https://esm.sh/@arkiv-network/sdk@0.6.0/chains?target=es2022&bundle-deps'
```
# Data Explorer

The [Arkiv Data Explorer](https://data.arkiv.network?utm_source=docs&utm_medium=referral&utm_campaign=data-explorer&utm_content=docs-page-hero) is a browser-based tool for querying and inspecting entities on Arkiv testnets. Reach for it when you want to verify that your app wrote what you expected, prototype a query before putting it in code, or simply explore what's on a testnet.

![The Arkiv Data Explorer landing screen, with the query editor and example queries.](../../../assets/data-explorer-home.png)

## Query editor

The query editor at the top of the Explorer accepts Arkiv's full query syntax — operators, attribute types, glob matching, and range filters.

For the full reference, see [Query syntax](https://docs.arkiv.network/json-rpc/querying-data/#query-syntax).

## Searching for entities or owners

Paste a raw value directly into the editor and the Explorer normalises it automatically:

- A 32-byte hex string becomes `$key = "0x…"`
- A 20-byte address becomes `$owner = "0x…"`

No manual quoting or operator selection needed.

## Sharing results

The current query and selected chain are always encoded in the URL. Copy the address bar to share an exact query — anyone who opens the link sees the same query pre-loaded and auto-run.
**Tip:** This makes Explorer links useful for bug reports: paste the URL and the recipient lands directly on the relevant result.

If you want a quick deep-link to a specific entity or owner from your own app, you can link directly:

- `https://data.arkiv.network/entity/0x123…` — opens the Explorer with that entity key pre-queried
- `https://data.arkiv.network/owner/0x123…` — opens the Explorer filtered by that owner address

# Braga

Braga is Arkiv's current testnet db-chain. It uses **test GLM as the native gas token** and produces blocks every 2 seconds. There is no Arkiv mainnet yet; everything you ship today runs on testnet.
**Migrating from Kaolin?:** Braga replaces the Kaolin testnet. If you have an app running on Kaolin, see the [migration guide](https://docs.arkiv.network/networks/migrate-from-kaolin/). Kaolin is scheduled to sunset on **15 May 2026**.

## Network details

| Property              | Value                                                                                |
| --------------------- | ------------------------------------------------------------------------------------ |
| Chain ID              | `60138453102`                                                                        |
| HTTP RPC              | `https://braga.hoodi.arkiv.network/rpc`                                              |
| WebSocket RPC         | `wss://braga.hoodi.arkiv.network/rpc/ws`                                             |
| Native gas token      | GLM                                                                                  |
| Block time            | 2 seconds                                                                            |
| Standard Bridge       | `0xB52b417A79c9dE21ffe221dF9a3821B7EaC60813`                                         |
| Faucet                | [braga.hoodi.arkiv.network/faucet](https://braga.hoodi.arkiv.network/faucet/)        |
| Explorer              | [explorer.braga.hoodi.arkiv.network](https://explorer.braga.hoodi.arkiv.network/)    |
| Bridge UI             | [braga.hoodi.arkiv.network/bridgette](https://braga.hoodi.arkiv.network/bridgette/)  |
| Status                | [status.braga.hoodi.arkiv.network](https://status.braga.hoodi.arkiv.network)         |

## Adding Braga to MetaMask

Click the button below to add the Braga testnet to your MetaMask wallet:

<button id="add-braga-btn" class="bg-arkiv-blue text-white hover:bg-arkiv-blue/95 cursor-pointer px-4 py-2 rounded" type="button" data-umami-event="add-braga-to-wallet">
  Add Braga to MetaMask
</button>
<p id="add-braga-msg" style="margin-top: 0.5rem; font-size: 0.875rem;"></p>

<script>{`
  document.getElementById('add-braga-btn').addEventListener('click', async () => {
    const msg = document.getElementById('add-braga-msg');
    if (typeof window.ethereum === 'undefined') {
      msg.textContent = 'MetaMask is not installed. Please install it first.';
      msg.style.color = 'var(--sl-color-red)';
      return;
    }
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0xe0087f86e',
          chainName: 'Arkiv Braga Testnet',
          nativeCurrency: { name: 'Golem', symbol: 'GLM', decimals: 18 },
          rpcUrls: ['https://braga.hoodi.arkiv.network/rpc'],
          blockExplorerUrls: ['https://explorer.braga.hoodi.arkiv.network'],
        }],
      });
      msg.textContent = 'Braga testnet added successfully!';
      msg.style.color = 'var(--sl-color-green)';
    } catch (err) {
      msg.textContent = 'Failed to add network: ' + (err.message || err);
      msg.style.color = 'var(--sl-color-red)';
    }
  });
`}</script>

Then get test GLM from the [Braga faucet](https://braga.hoodi.arkiv.network/faucet/).

# Querying Data

Read entities from Arkiv using the TypeScript SDK's public client and its chainable query builder — with support for filtering, pagination, ordering, and payload retrieval.

## PublicClient Setup

All queries use the read-only public client:

```ts
import { createPublicClient, http } from "@arkiv-network/sdk"
import { braga } from "@arkiv-network/sdk/chains"

const publicClient = createPublicClient({
  chain: braga,
  transport: http(),
})
```

## Building Queries

Use `buildQuery()` to construct queries with chainable methods:

```ts
import { eq, gt } from "@arkiv-network/sdk/query"

const result = await publicClient
  .buildQuery()
  .where(eq('type', 'note'))
  .where(gt('created', Date.now() - 86400000))
  .withPayload(true)
  .withAttributes(true)
  .limit(10)
  .fetch()

console.log('Found:', result.entities.length)
```

### Query Builder Methods

| Method | Description |
|--------|-------------|
| `.where(condition)` | Add a filter condition (chainable) |
| `.withPayload(true)` | Include entity payload in results |
| `.withAttributes(true)` | Include attributes in results |
| `.withMetadata(true)` | Include metadata (owner, creator, TTL) |
| `.ownedBy(address)` | Filter by current owner |
| `.createdBy(address)` | Filter by original creator (immutable) |
| `.orderBy(desc('field', 'type'))` | Order results |
| `.limit(n)` | Limit number of results |
| `.fetch()` | Execute the query |

### Passing Multiple Conditions

You can chain `.where()` calls or pass an array:

```ts
// Chained — each .where() adds an AND condition
const result = await publicClient
  .buildQuery()
  .where(eq('type', 'note'))
  .where(gt('priority', 3))
  .fetch()

// Array syntax — equivalent to above
const result = await publicClient
  .buildQuery()
  .where([eq('type', 'note'), gt('priority', 3)])
  .fetch()
```

## Query Operators

```ts
import { eq, gt, lt, gte, lte } from "@arkiv-network/sdk/query"

eq('type', 'note')        // type = "note"
gt('priority', 3)          // priority > 3
lt('price', 1000)          // price < 1000
gte('created', timestamp)  // created >= timestamp
lte('expiration', limit)   // expiration <= limit
```
**Note:** String attributes only support `eq()`. Numeric attributes support all comparison operators. Always store numbers as numeric attributes if you need range queries.

## Filtering by Owner and Creator

Every entity has two metadata fields:

- **`$owner`** — The wallet that currently owns the entity. Can change via ownership transfer.
- **`$creator`** — The wallet that originally created the entity. Immutable — can never change.

```ts
// Filter by current owner
const owned = await publicClient
  .buildQuery()
  .where(eq('type', 'note'))
  .ownedBy('0xOwnerAddress')
  .withPayload(true)
  .withMetadata(true)
  .fetch()

// Filter by original creator (tamper-proof)
const created = await publicClient
  .buildQuery()
  .where(eq('type', 'note'))
  .createdBy('0xCreatorAddress')
  .withPayload(true)
  .withMetadata(true)
  .fetch()
```
**Tip:** Use `.createdBy()` when you need a tamper-proof guarantee of who wrote the data (e.g., verifying data came from your trusted backend). Since `$creator` is immutable, it cannot be spoofed after creation.

## Getting a Single Entity

Retrieve a specific entity by key:

```ts
const entity = await publicClient.getEntity(entityKey)

// Parse the payload
const data = entity.toJson()   // JSON payload
const text = entity.toText()   // Text payload
```

## Reading Results

```ts
const result = await publicClient
  .buildQuery()
  .where(eq('type', 'note'))
  .withPayload(true)
  .withAttributes(true)
  .fetch()

for (const entity of result.entities) {
  // Access payload
  const data = entity.toJson()
  console.log(data.title, data.content)

  // Access entity key
  console.log('Key:', entity.key)

  // Access attributes (when withAttributes is true)
  for (const attr of entity.attributes) {
    console.log(`${attr.key}: ${attr.value}`)
  }
}
```

## Pagination

Arkiv uses cursor-based pagination. Results per page are capped at 200.

```ts
const result = await publicClient
  .buildQuery()
  .where(eq('type', 'note'))
  .withPayload(true)
  .limit(10)
  .fetch()

console.log('Page 1:', result.entities.length)

// Check for more pages
if (result.hasNextPage()) {
  await result.next()
  console.log('Page 2:', result.entities.length)
}
```

## Ordering Results

```ts
import { desc } from "@arkiv-network/sdk/query"

const result = await publicClient
  .buildQuery()
  .where(eq('type', 'sketch'))
  .ownedBy(userAddress)
  .orderBy(desc('timestamp', 'number'))
  .withPayload(true)
  .limit(9)
  .fetch()
```

:::caution[String pattern matching]
The protocol supports glob matching on string attributes (`attribute ~ "My_Project_*"`), but the operator is not yet exposed in the TypeScript SDK. If you need pattern matching today, use the [JSON-RPC API](https://docs.arkiv.network/json-rpc/querying-data/) directly.
:::

# Mutating Data

Learn how to create, update, delete, and extend entities on Arkiv using the TypeScript SDK's wallet client.

## WalletClient Setup

All write operations require a wallet client:

```ts
import { createWalletClient, http } from "@arkiv-network/sdk"
import { privateKeyToAccount } from "@arkiv-network/sdk/accounts"
import { braga } from "@arkiv-network/sdk/chains"

const walletClient = createWalletClient({
  chain: braga,
  transport: http(),
  account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
})
```
**Caution:** Keep private keys in environment variables. Never hardcode them.

## Payload Helpers

Convert data to Arkiv payloads before storing:

```ts
import { jsonToPayload, stringToPayload, payloadToString } from "@arkiv-network/sdk/utils"

// JSON data
const jsonPayload = jsonToPayload({ title: "My Note", content: "Hello!" })

// Plain text
const textPayload = stringToPayload("Hello Arkiv!")

// Reading back
const text = payloadToString(entity.payload)
const data = entity.toJson()
```

## Create Entity

```ts
import { jsonToPayload, ExpirationTime } from "@arkiv-network/sdk/utils"

const { entityKey, txHash } = await walletClient.createEntity({
  payload: jsonToPayload({ title: "My Note", content: "Hello Arkiv!" }),
  contentType: "application/json",
  attributes: [
    { key: "type", value: "note" },
    { key: "id", value: crypto.randomUUID() },
    { key: "created", value: Date.now() },
  ],
  expiresIn: ExpirationTime.fromHours(12),
})

console.log("Created:", entityKey)
```

### Parameters

| Field | Type | Description |
|-------|------|-------------|
| `payload` | `Uint8Array` | Entity data (use `jsonToPayload` or `stringToPayload`) |
| `contentType` | `string` | MIME type (`application/json`, `text/plain`, etc.) |
| `attributes` | `Array` | Key-value pairs for querying |
| `expiresIn` | `number` | Lifetime in seconds (use `ExpirationTime` helpers) |

### Returns

| Field | Type | Description |
|-------|------|-------------|
| `entityKey` | `string` | Unique identifier for the entity |
| `txHash` | `string` | Transaction hash on the chain |

## Update Entity

Replace an entity's payload, attributes, and expiration:

```ts
const { txHash } = await walletClient.updateEntity({
  entityKey: entityKey,
  payload: jsonToPayload({ title: "Updated Note", content: "New content" }),
  contentType: "application/json",
  attributes: [
    { key: "type", value: "note" },
    { key: "updated", value: Date.now() },
  ],
  expiresIn: ExpirationTime.fromHours(24),
})
```
**Caution:** `updateEntity` is a **full replace**, not a patch. It overwrites the entire payload and all attributes. If you omit an attribute from the update call, it will be silently removed from the entity. Always re-send every attribute you want to keep.

## Delete Entity

```ts
const { txHash } = await walletClient.deleteEntity({
  entityKey: entityKey,
})
```

## Change Ownership

Transfer an entity to a new owner:

```ts
const { entityKey, txHash } = await walletClient.changeOwnership({
  entityKey: entityKey,
  newOwner: "0x1234567890abcdef1234567890abcdef12345678",
})
```
**Caution:** Only the current owner can transfer ownership. After the transfer, you lose the ability to update, delete, or extend the entity.

### Parameters

| Field | Type | Description |
|-------|------|-------------|
| `entityKey` | `Hex` | Key of the entity to transfer |
| `newOwner` | `Hex` | Address of the new owner |

### Returns

| Field | Type | Description |
|-------|------|-------------|
| `entityKey` | `Hex` | Key of the transferred entity |
| `txHash` | `string` | Transaction hash on the chain |

## Extend Expiration

Add more time to an entity before it expires:

```ts
const { txHash } = await walletClient.extendEntity({
  entityKey: entityKey,
  expiresIn: ExpirationTime.fromHours(1),
})
```
**Tip:** Start with a short expiration and extend when needed. Over-allocating wastes storage fees.

## Batch Operations

Create multiple entities in a single transaction using `mutateEntities()`:

```ts
await walletClient.mutateEntities({
  creates: [
    {
      payload: jsonToPayload({ content: "Item 1" }),
      contentType: "application/json",
      attributes: [{ key: "type", value: "item" }],
      expiresIn: ExpirationTime.fromMinutes(30),
    },
    {
      payload: jsonToPayload({ content: "Item 2" }),
      contentType: "application/json",
      attributes: [{ key: "type", value: "item" }],
      expiresIn: ExpirationTime.fromMinutes(30),
    },
  ],
})
```
**Caution:** Don't use a loop with individual `createEntity()` calls — that's slow and expensive. Always use `mutateEntities()` for batch operations.

### Batch with Dynamic Data

```ts
const items = ["frontend", "backend", "devops"]

await walletClient.mutateEntities({
  creates: items.map((skill) => ({
    payload: jsonToPayload({ profileId: "alice-123", skill }),
    contentType: "application/json",
    attributes: [
      { key: "type", value: "skill" },
      { key: "profileId", value: "alice-123" },
      { key: "skill", value: skill },
    ],
    expiresIn: ExpirationTime.fromDays(30),
  })),
})
```

## ExpirationTime Reference

Always use the helper instead of raw numbers:

```ts
import { ExpirationTime } from "@arkiv-network/sdk/utils"

ExpirationTime.fromMinutes(30)  // 1800 seconds
ExpirationTime.fromHours(1)     // 3600 seconds
ExpirationTime.fromHours(12)    // 43200 seconds
ExpirationTime.fromHours(24)    // 86400 seconds
ExpirationTime.fromDays(7)      // 604800 seconds
```

## Browser Usage with MetaMask

In browser applications, use MetaMask as the transport instead of a private key:

```ts
import { createWalletClient, custom } from "@arkiv-network/sdk"
import { braga } from "@arkiv-network/sdk/chains"

// Request wallet connection
await window.ethereum.request({ method: 'eth_requestAccounts' })

// Use MetaMask as transport
const walletClient = createWalletClient({
  chain: braga,
  transport: custom(window.ethereum),
})
```

See the [MetaMask Sketch App tutorial](https://docs.arkiv.network/learn/metamask-sketch-app/) for a complete browser example.

## Error Handling

The SDK does not retry on failure — all methods throw on error. Wrap write operations in try/catch:

```ts
try {
  const { entityKey, txHash } = await walletClient.createEntity({
    payload: jsonToPayload({ title: "My Post" }),
    contentType: "application/json",
    attributes: [{ key: "type", value: "post" }],
    expiresIn: ExpirationTime.fromHours(12),
  })
} catch (error) {
  // Common failures:
  // - User rejected the transaction (MetaMask popup dismissed)
  // - Insufficient funds / gas
  // - Network error (RPC unreachable)
  // - Entity already expired (for update/extend)
  console.error("Transaction failed:", error)
}
```

# Live Events

The `subscribeEntityEvents` method on the public client lets you listen for entity changes in real time. It polls the chain for new events and fires callbacks when entities are created, updated, deleted, expired, or have their expiration extended.

## Basic Usage

```ts
import { createPublicClient, http } from "@arkiv-network/sdk"
import { braga } from "@arkiv-network/sdk/chains"

const client = createPublicClient({
  chain: braga,
  transport: http(),
})

const unsubscribe = await client.subscribeEntityEvents({
  onEntityCreated: (event) => {
    console.log("Entity created:", event.entityKey)
  },
  onEntityUpdated: (event) => {
    console.log("Entity updated:", event.entityKey)
  },
  onEntityDeleted: (event) => {
    console.log("Entity deleted:", event.entityKey)
  },
  onEntityExpired: (event) => {
    console.log("Entity expired:", event.entityKey)
  },
  onEntityExpiresInExtended: (event) => {
    console.log("Entity extended:", event.entityKey)
  },
  onError: (error) => {
    console.error("Subscription error:", error)
  },
})

// Later, stop listening:
unsubscribe()
```
**Note:** All event handlers are optional. Subscribe only to the events you care about.

## Parameters

`subscribeEntityEvents` takes the event handlers object, plus two optional arguments:

| Parameter | Type | Description |
|-----------|------|-------------|
| Event handlers | `object` | Object with callback functions (see below) |
| `pollingInterval` | `number` | Polling interval in milliseconds (optional) |
| `fromBlock` | `bigint` | Block number to start listening from (optional) |

### Event Handlers

| Handler | Event Type | Fires When |
|---------|-----------|------------|
| `onEntityCreated` | `OnEntityCreatedEvent` | A new entity is created |
| `onEntityUpdated` | `OnEntityUpdatedEvent` | An entity's payload or attributes change |
| `onEntityDeleted` | `OnEntityDeletedEvent` | An entity is deleted by its owner |
| `onEntityExpired` | `OnEntityExpiredEvent` | An entity's expiration time is reached |
| `onEntityExpiresInExtended` | `OnEntityExpiresInExtendedEvent` | An entity's expiration is extended |
| `onError` | `Error` | An error occurs during polling |

## Event Types

### OnEntityCreatedEvent

```ts
{
  entityKey: Hex       // Key of the new entity
  owner: Hex           // Address of the entity owner
  expirationBlock: number  // Block when the entity expires
  cost: bigint         // Storage cost of the operation
}
```

### OnEntityUpdatedEvent

```ts
{
  entityKey: Hex       // Key of the updated entity
  owner: Hex           // Address of the entity owner
  oldExpirationBlock: number  // Previous expiration block
  newExpirationBlock: number  // New expiration block
  cost: bigint         // Storage cost of the operation
}
```

### OnEntityDeletedEvent

```ts
{
  entityKey: Hex       // Key of the deleted entity
  owner: Hex           // Address of the entity owner
}
```

### OnEntityExpiredEvent

```ts
{
  entityKey: Hex       // Key of the expired entity
  owner: Hex           // Address of the entity owner
}
```

### OnEntityExpiresInExtendedEvent

```ts
{
  entityKey: Hex       // Key of the extended entity
  owner: Hex           // Address of the entity owner
  oldExpirationBlock: number  // Previous expiration block
  newExpirationBlock: number  // New expiration block
  cost: bigint         // Storage cost of the operation
}
```

## Polling from a Specific Block

Use `fromBlock` to replay events starting from a past block:

```ts
const unsubscribe = await client.subscribeEntityEvents(
  {
    onEntityCreated: (event) => {
      console.log("Created:", event.entityKey, "at cost:", event.cost)
    },
  },
  5000,  // poll every 5 seconds
  100n,  // start from block 100
)
```

## Practical Example

Listen for changes to your own entities and log a summary:

```ts
import { createPublicClient, http } from "@arkiv-network/sdk"
import { braga } from "@arkiv-network/sdk/chains"

const client = createPublicClient({
  chain: braga,
  transport: http(),
})

const MY_ADDRESS = "0xYourAddress..."

const unsubscribe = await client.subscribeEntityEvents({
  onEntityCreated: (event) => {
    if (event.owner === MY_ADDRESS) {
      console.log(`New entity ${event.entityKey} expires at block ${event.expirationBlock}`)
    }
  },
  onEntityDeleted: (event) => {
    if (event.owner === MY_ADDRESS) {
      console.log(`Entity ${event.entityKey} was deleted`)
    }
  },
  onEntityExpired: (event) => {
    if (event.owner === MY_ADDRESS) {
      console.log(`Entity ${event.entityKey} has expired`)
    }
  },
  onError: (error) => {
    console.error("Event stream error:", error)
  },
})

// Clean up on exit
process.on("SIGINT", () => {
  unsubscribe()
  process.exit()
})
```
**Tip:** Always call the returned `unsubscribe()` function when you no longer need events — this stops polling and frees resources.

# Best Practices

A collection of essential patterns and conventions for building reliable, production-ready applications with Arkiv — covering project attributes, data modeling, security, and error handling.

## 1. Always Use a Project Attribute

All entities in Arkiv are public and stored in a shared database. Every project **must** define a unique project attribute and include it on every entity. This is how you distinguish your app's data from everyone else's.

Create a dedicated file that exports this attribute:

```ts title="lib/arkiv.ts"
export const PROJECT_ATTRIBUTE = {
  key: "project",
  value: "myapp-acme-7x9k", // use a globally unique string
} as const;
```

Include it in **every** create/update call and **every** query:

```ts
import { PROJECT_ATTRIBUTE } from "./lib/arkiv"

// Creating — always include PROJECT_ATTRIBUTE
const { entityKey } = await walletClient.createEntity({
  payload: jsonToPayload({ title, content }),
  contentType: "application/json",
  attributes: [PROJECT_ATTRIBUTE, { key: "entityType", value: "post" }],
  expiresIn: ExpirationTime.fromDays(30),
})

// Querying — always filter by PROJECT_ATTRIBUTE
const result = await publicClient
  .buildQuery()
  .where([
    eq(PROJECT_ATTRIBUTE.key, PROJECT_ATTRIBUTE.value),
    eq("entityType", "post"),
  ])
  .withPayload(true)
  .limit(50)
  .fetch()
```
**Danger:** Without a project attribute, your queries may return data from other projects, and other projects may see yours.

## 2. Separate Read and Write Clients

Always use `createPublicClient` for queries. It prevents accidental writes, doesn't require a private key, and is safe for frontend use. Reserve `createWalletClient` for backend services that create, update, or delete entities.

## 3. Design Attributes for Queryability

Attributes are your indexes. Without the right ones, you'll fetch too much data and filter client-side.

```ts
// Good: attributes map to your query patterns
attributes: [
  { key: "type", value: "vote" },           // filter by entity type
  { key: "proposalKey", value: proposalId }, // link related entities
  { key: "voter", value: voterAddr },        // filter by user
  { key: "choice", value: "yes" },           // filter by value
  { key: "weight", value: 1 },              // numeric for aggregation
]
```

## 4. Use Batch Operations

Individual creates in a loop are slow and expensive. Use `mutateEntities()`:

```ts
// Bad — sequential, slow
for (const item of items) {
  await walletClient.createEntity(item)
}

// Good — single batch operation
await walletClient.mutateEntities({
  creates: items.map((item) => ({
    payload: jsonToPayload(item.data),
    contentType: "application/json",
    attributes: item.attributes,
    expiresIn: ExpirationTime.fromHours(1),
  })),
})
```

## 5. Write Specific Queries

Broad queries return too much data. Always add multiple filter criteria:

```ts
// Bad — returns every note ever
await query.where(eq("type", "note")).fetch()

// Good — narrows to what you need
await query
  .where(eq("type", "note"))
  .where(gt("created", Date.now() - 86400000))
  .where(gt("priority", 3))
  .fetch()
```

## 6. Right-Size Expiration

Match `expiresIn` to actual data lifetime:

| Use Case | Duration |
|----------|----------|
| Session data | `ExpirationTime.fromMinutes(30)` |
| Cache | `ExpirationTime.fromHours(1)` |
| Temp files | `ExpirationTime.fromHours(24)` |
| Weekly data | `ExpirationTime.fromDays(7)` |

Don't over-allocate — it costs more and pollutes queries with stale data.

## 7. Never Expose Private Keys

```ts
// Always load from environment
const privateKey = process.env.PRIVATE_KEY

// Never hardcode
const privateKey = "0x1234..." // DANGEROUS
```

## 8. Validate Input Before Storing

Check length and content before creating entities:

```ts
function createNote(userInput: string) {
  if (!userInput || userInput.length > 10000) {
    throw new Error("Invalid input")
  }
  const sanitized = userInput.trim()
  return walletClient.createEntity({
    payload: stringToPayload(sanitized),
    contentType: "text/plain",
    attributes: [{ key: "type", value: "note" }],
    expiresIn: ExpirationTime.fromHours(12),
  })
}
```

## 9. Use Numeric Types for Numeric Data

If you'll filter or sort by a value, store it as a number attribute. String attributes only support equality and glob matching.

```ts
// Good: numeric — supports gt(), lt() operators
{ key: 'priority', value: 5 }

// Bad: string — only eq() works
{ key: 'priority', value: '5' }
```

## 10. Model Related Data with Shared Attributes

Link entities together using a shared attribute key. This is Arkiv's version of foreign keys:

```ts
// Proposal entity
attributes: [{ key: "type", value: "proposal" }]

// Vote entities reference the proposal
attributes: [
  { key: "type", value: "vote" },
  { key: "proposalKey", value: proposalEntityKey },
]

// Query all votes for a proposal
await query
  .where(eq("type", "vote"))
  .where(eq("proposalKey", proposalEntityKey))
  .fetch()
```

## 11. Understand $owner vs $creator

- **`$owner`** — The wallet that currently owns the entity. Can change via ownership transfer. Use `.ownedBy()` to check who can modify/delete.
- **`$creator`** — The wallet that originally created the entity. Immutable. Use `.createdBy()` for tamper-proof source verification.

## 12. Filter by Creator for Trusted Data

When your backend publishes data that a frontend reads, filtering by `PROJECT_ATTRIBUTE` alone is **not enough**. A malicious actor can create entities with your project attribute.

Combine project filtering with `.createdBy()`:

```ts title="lib/arkiv.ts"
export const PROJECT_ATTRIBUTE = {
  key: "project",
  value: "myapp-acme-7x9k",
} as const;

export const CREATOR_WALLET_ADDRESS = "0xYourBackendWalletAddress";
```

```ts
import { PROJECT_ATTRIBUTE, CREATOR_WALLET_ADDRESS } from "./lib/arkiv"

const trustedPosts = await publicClient
  .buildQuery()
  .where([
    eq(PROJECT_ATTRIBUTE.key, PROJECT_ATTRIBUTE.value),
    eq("entityType", "post"),
  ])
  .createdBy(CREATOR_WALLET_ADDRESS)
  .withPayload(true)
  .fetch()
```
**Tip:** `$creator` is immutable — no one can fake it. Even if someone creates an entity with your project attribute, it won't pass the `.createdBy()` filter.

## 13. Handle Errors Gracefully

The SDK does not retry on failure. Wrap write operations in try/catch and handle each failure mode:

```ts
try {
  const { entityKey } = await walletClient.createEntity({ ... })
} catch (error) {
  // - User rejected the transaction (MetaMask dismissed)
  // - Insufficient funds / gas
  // - Network error (RPC unreachable)
  // - Entity already expired (for update/extend)
  console.error("Transaction failed:", error)
}
```

## 14. Validate Entity Data with Schemas

`entity.toJson()` returns `any`. Validate with a schema library to protect against malformed payloads:

```ts
import { z } from "zod"

const PostSchema = z.object({
  title: z.string(),
  content: z.string(),
  author: z.string().optional(),
})

type Post = z.infer<typeof PostSchema>

function parsePost(entity: any): Post {
  const raw = entity.toJson()
  const result = PostSchema.safeParse(raw)
  if (!result.success) {
    throw new Error("Entity data does not match expected schema")
  }
  return result.data
}
```

## 15. Model Lists with Relationship Entities

Arkiv attributes are flat key-value pairs — there is no array type. Don't try to encode lists into attributes:

```ts
// BAD — can't query "all profiles with skill frontend"
attributes: [
  { key: "skills_0", value: "frontend" },
  { key: "skills_1", value: "backend" },
]

// BAD — can't query individual skills
attributes: [
  { key: "skills", value: "frontend, backend, devops" },
]
```

Instead, create separate **relationship entities**:

```ts
// 1. Create the profile
const { entityKey: profileKey } = await walletClient.createEntity({
  payload: jsonToPayload({ name: "Alice", bio: "Full-stack dev" }),
  contentType: "application/json",
  attributes: [
    PROJECT_ATTRIBUTE,
    { key: "entityType", value: "profile" },
    { key: "profileId", value: "alice-123" },
  ],
  expiresIn: ExpirationTime.fromDays(30),
})

// 2. One relationship entity per skill
const skills = ["frontend", "backend", "devops"]
await walletClient.mutateEntities({
  creates: skills.map((skill) => ({
    payload: jsonToPayload({ profileId: "alice-123", skill }),
    contentType: "application/json",
    attributes: [
      PROJECT_ATTRIBUTE,
      { key: "entityType", value: "profileSkill" },
      { key: "profileId", value: "alice-123" },
      { key: "skill", value: skill },
    ],
    expiresIn: ExpirationTime.fromDays(30),
  })),
})

// 3. Query all profiles with "frontend" skill
const frontendDevs = await publicClient
  .buildQuery()
  .where([
    eq(PROJECT_ATTRIBUTE.key, PROJECT_ATTRIBUTE.value),
    eq("entityType", "profileSkill"),
    eq("skill", "frontend"),
  ])
  .withPayload(true)
  .fetch()
```

