---
name: Privy
description: Use when building authentication systems, embedded wallets, wallet infrastructure, transaction signing, and wallet controls. Reach for this skill when implementing user onboarding, creating wallets for users or servers, signing transactions, enforcing transaction policies, managing wallet access controls, or integrating with blockchain networks.
metadata:
    mintlify-proj: privy
    version: "1.0"
---

# Privy Skill Reference

## Product summary

Privy is an authentication and wallet infrastructure platform that enables developers to onboard users, create embedded wallets, and manage blockchain transactions with fine-grained controls. Use Privy to authenticate users via email, social logins, passkeys, or wallet connections; create self-custodial or server-controlled wallets across 50+ blockchains; sign transactions with policies that enforce spending limits and recipient restrictions; and manage wallet access through owners, signers, and authorization keys.

**Key files and concepts:**
- **App ID and App Secret**: Found in Privy Dashboard > App Settings > Basics. Required for all API calls.
- **PrivyProvider**: React component that wraps your app and initializes the Privy SDK.
- **Authorization keys**: P256 cryptographic keys that control wallets and policies. Generated via Dashboard or SDK.
- **Policies**: Rules that constrain wallet actions (spending limits, allowlisted addresses, contract interactions).
- **Owners and signers**: Owners have full control; signers have scoped permissions.
- **Primary docs**: https://docs.privy.io

## When to use

Reach for this skill when:
- **Authenticating users**: Implementing login flows with email, SMS, social OAuth, passkeys, or wallet connections
- **Creating wallets**: Spinning up embedded wallets for users (client-side) or servers (backend)
- **Signing transactions**: Requesting signatures for Ethereum, Solana, or other blockchain transactions
- **Enforcing controls**: Setting up policies to limit transaction amounts, restrict recipients, or control contract interactions
- **Managing access**: Configuring wallet owners, signers, and authorization keys for multi-party control
- **Server-side operations**: Using authorization keys to execute wallet actions from your backend
- **Handling webhooks**: Reacting to user authentication, wallet creation, or transaction lifecycle events
- **Troubleshooting**: Debugging policy violations, authorization errors, or transaction failures

## Quick reference

### SDK Installation

| Platform | Command |
|----------|---------|
| React | `npm install @privy-io/react-auth@latest` |
| React Native | `npm install @privy-io/expo@latest` |
| Node.js | `npm install @privy-io/node@latest` |
| Python | `pip install privy-python` |
| Java | Maven/Gradle dependency |
| Go | `go get github.com/privy-io/privy-go` |
| REST API | Use Basic Auth with app ID and secret |

### API Authentication Headers

All REST API requests require:
```
Authorization: Basic <base64(app_id:app_secret)>
privy-app-id: <your-app-id>
```

### Core Wallet Types

| Type | Ownership | Use Case |
|------|-----------|----------|
| User-owned embedded | User controls keys | Self-custodial consumer wallets |
| User-owned with server access | User owns, server has scoped permissions | Automated trading, limit orders |
| Application-owned | Authorization key controls | Treasury, trading bots, agents |
| Custodial | Licensed custodian operates | FBO banking-like models |

### Common RPC Methods

| Chain | Methods |
|-------|---------|
| Ethereum | `eth_sendTransaction`, `eth_signTransaction`, `eth_signTypedData_v4`, `personal_sign`, `eth_sign7702Authorization` |
| Solana | `signTransaction`, `signAndSendTransaction`, `signMessage` |
| Other chains | `signTransactionBytes` (Tron, Sui), `transfer` (Bitcoin) |

### Policy Rule Structure

```json
{
  "name": "Rule name",
  "method": "eth_sendTransaction",
  "conditions": [
    {
      "field_source": "ethereum_transaction",
      "field": "value",
      "operator": "lte",
      "value": "1000000000000000000"
    }
  ],
  "action": "ALLOW"
}
```

## Decision guidance

### When to use embedded wallets vs external wallets

| Scenario | Embedded | External |
|----------|----------|----------|
| New users with no crypto experience | ✓ | |
| Users bringing existing wallets | | ✓ |
| Need seamless onboarding UX | ✓ | |
| Users want to control keys directly | | ✓ |
| Building a consumer app | ✓ | |
| Building for power users | | ✓ |

### When to use Privy authentication vs JWT-based auth

| Scenario | Privy Auth | JWT-based |
|----------|-----------|-----------|
| No existing auth system | ✓ | |
| Want multiple login methods | ✓ | |
| Already have Auth0/Firebase | | ✓ |
| Need email + social + wallet logins | ✓ | |
| Integrating with existing provider | | ✓ |

### When to use wallet actions vs RPC methods

| Scenario | Wallet Actions | RPC Methods |
|----------|----------------|------------|
| Simple transfers | ✓ | |
| Swaps with quotes | ✓ | |
| Earn/yield deposits | ✓ | |
| Custom contract interactions | | ✓ |
| Raw transaction signing | | ✓ |
| Need abstracted APIs | ✓ | |

## Workflow

### 1. Set up your Privy app
- Create organization in Privy Dashboard
- Create app and obtain app ID
- Generate app secret for server-side API calls
- Configure login methods (email, OAuth, wallet, etc.)
- Set up app clients for different environments if needed

### 2. Implement authentication
- **Client-side (React)**: Wrap app with `PrivyProvider`, use `usePrivy()` hook to access `login()` and `user` state
- **Server-side**: Verify user JWT tokens from client, use identity tokens for secure user data access
- **Custom auth**: Integrate with existing JWT provider via `/wallets/authenticate` endpoint

### 3. Create wallets
- **Client-side**: Use `useCreateWallet()` hook after user logs in, optionally set `createOnLogin: 'users-without-wallets'`
- **Server-side**: Call `POST /v1/wallets` with user ID or authorization key as owner
- **Batch creation**: Use `POST /v1/users/pregenerate-wallets` to create wallets for multiple users

### 4. Configure controls and policies
- Create authorization keys via Dashboard or `generateP256KeyPair()` for server control
- Define policies with rules that specify allowed RPC methods and conditions
- Assign policies to wallets at creation or via update endpoints
- Set up owners (users or authorization keys) and additional signers for multi-party control

### 5. Execute transactions
- **Client-side**: Get wallet provider via `useWallets()`, call RPC methods or wallet action APIs
- **Server-side**: Use authorization key to sign requests, call wallet RPC or action endpoints
- **Policy evaluation**: Privy evaluates policies in secure enclaves before executing transactions

### 6. Monitor and react
- Set up webhooks for user events (`user.created`, `user.authenticated`), wallet events (`wallet.funds_deposited`), and transaction events (`transaction.confirmed`, `transaction.failed`)
- Verify webhook signatures using Privy's signing key
- Use webhooks to sync your backend with wallet state

## Common gotchas

- **Policy defaults to DENY**: If a wallet has a policy, it must explicitly allow each RPC method or wallet action. Missing rules are denied by default.
- **Authorization signatures required**: Server-side wallet updates and certain API calls require signatures from authorization keys. Missing or invalid signatures return `missing_or_empty_authorization_header` or `zero_correct_authorization_signatures` errors.
- **User session keys expire**: User signing keys are time-bound. Refresh them before making requests. Server SDKs with `AuthorizationContext` handle this automatically.
- **Policies evaluated in enclaves**: Policy evaluation happens in secure execution environments before signing. You cannot inspect or debug policy evaluation directly.
- **Wallet creation rate limits**: Wallet creation endpoints are rate-limited. Implement exponential backoff for retries.
- **Gas sponsorship credits deplete**: If using gas sponsorship, monitor credits in Dashboard > Billing. Enable automated refill to avoid `insufficient_funds` errors.
- **Solana instructions must be explicitly allowed**: Each instruction in a Solana transaction is evaluated separately. All instructions must satisfy policy rules.
- **External IDs are write-once**: Once set on a wallet, external IDs cannot be changed. Plan your naming scheme carefully.
- **Whitelabel login incompatible with automatic wallet creation**: Automatic wallet creation only works with the Privy modal, not whitelabel login methods.
- **Idempotency keys prevent duplicates**: Use idempotency keys on wallet creation and transaction requests to safely retry without creating duplicates.

## Verification checklist

Before submitting work with Privy:

- [ ] **Authentication flow tested**: Users can log in via configured methods and receive valid JWT tokens
- [ ] **Wallet creation verified**: Wallets are created with correct owners and appear in Dashboard
- [ ] **Policies applied correctly**: Policies are attached to wallets and rules match intended RPC methods
- [ ] **Authorization keys secured**: Private keys stored securely, never logged or exposed in client code
- [ ] **Signatures valid**: Authorization signatures include correct headers (`privy-authorization-signature`, `privy-request-expiry`)
- [ ] **Webhooks configured**: Webhook endpoint registered, signatures verified, events logged
- [ ] **Error handling in place**: Try/catch blocks wrap API calls, user-friendly error messages shown
- [ ] **Rate limits handled**: Exponential backoff implemented for rate-limited endpoints
- [ ] **Gas/funds available**: Wallets have sufficient native tokens or gas sponsorship credits
- [ ] **Policy rules tested**: Allowed transactions succeed, denied transactions fail with `policy_violation`
- [ ] **Cross-environment tested**: App clients configured for dev/staging/prod if needed

## Resources

- **Comprehensive page listing**: https://docs.privy.io/llms.txt
- **API Reference**: https://docs.privy.io/api-reference/introduction
- **Key Concepts**: https://docs.privy.io/basics/key-concepts
- **Controls and Policies**: https://docs.privy.io/controls/overview

---

> For additional documentation and navigation, see: https://docs.privy.io/llms.txt