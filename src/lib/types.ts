/**
 * Canonical Schema Enums and Types for Outformer Admin
 * Matched with Sonic-API schema (Sonic-API/src/types/enums.ts)
 */

export enum PlanType {
  HOURLY = "HOURLY",
  MONTHLY = "MONTHLY",
}

export enum SubscriptionPlan {
  FREE = "FREE",
  HOURLY = "HOURLY",
  MONTHLY = "MONTHLY",
}

export enum MembershipTier {
  STANDARD = "STANDARD",
  PRO = "PRO",
}

export enum EntityStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  USER_DROPPED = "USER_DROPPED",
  EXPIRED = "EXPIRED",
}

export enum PaymentGateway {
  CASHFREE = "CASHFREE",
  RAZORPAY = "RAZORPAY",
  MANUAL = "MANUAL",
}

export enum CouponType {
  PERCENTAGE = "PERCENTAGE",
  FIXED = "FIXED",
}

export enum FulfillmentType {
  WHISPER = "WHISPER",
  SNIP_TYPING = "SNIP_TYPING",
  MONTHLY_SUBSCRIPTION = "MONTHLY_SUBSCRIPTION",
  MEMBERSHIP = "MEMBERSHIP",
}

export enum SessionStatus {
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  TERMINATED = "TERMINATED",
}

export enum LedgerType {
  INFLOW = "INFLOW",
  OUTFLOW = "OUTFLOW",
}

export enum LedgerCategory {
  WHISPER = "WHISPER",
  SNIP_TYPING = "SNIP_TYPING",
  ASSISTANT = "ASSISTANT",
  PURCHASE = "PURCHASE",
  ADJUSTMENT = "ADJUSTMENT",
}

export interface PricingPackage {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  description: string;
  planType?: PlanType;
  accentColor?: string;
  borderColor?: string;
  gradient?: string;
  isPopular?: boolean;
  status: EntityStatus;
  fulfillment: Array<{
    type: FulfillmentType;
    quantity: number;
    label: string;
  }>;
  items?: Array<{
    label: string;
    sublabel: string;
  }>;
}

export interface AddonItem {
  id: string;
  name: string;
  type: string;
  price: number;
  durationMonths?: number;
  discountPercent?: number;
  description: string;
  status: 'ACTIVE' | 'INACTIVE';
  fulfillment?: Array<{
    type: string;
    quantity: number;
    label: string;
  }>;
}

