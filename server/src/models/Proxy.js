import mongoose from "mongoose";

const { Schema, model } = mongoose;

const PROXY_TYPES = ["residential", "isp", "datacenter", "mobile"];
const PROXY_PROTOCOLS = ["http", "https", "socks5"];
const PROXY_STATUSES = ["pending", "active", "inactive", "dead", "expired"];

const ProxySchema = new Schema(
  {
    host: { type: String, required: true, trim: true },
    port: {
      type: Number,
      required: true,
      min: 1,
      max: 65535,
    },
    username: { type: String, default: null },
    password: { type: String, default: null },
    source: { type: String, default: null, trim: true },
    type: {
      type: String,
      enum: PROXY_TYPES,
      required: true,
    },
    protocol: {
      type: String,
      enum: PROXY_PROTOCOLS,
      default: null,
    },
    label: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: PROXY_STATUSES,
      default: "pending",
    },
    country: { type: String, default: null, trim: true },
    city: { type: String, default: null, trim: true },
    notes: { type: String, default: null },
    tags: { type: [String], default: [] },
    lastCheckedAt: { type: Date, default: null },
    lastKnownIp: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    cost: { type: Number, default: null },
    currency: { type: String, default: null, trim: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

ProxySchema.index({ status: 1 });
ProxySchema.index({ type: 1 });
ProxySchema.index({ source: 1 });
ProxySchema.index(
  { host: 1, port: 1, username: 1, password: 1 },
  { unique: true },
);

export { PROXY_TYPES, PROXY_PROTOCOLS, PROXY_STATUSES };
export const Proxy = model("Proxy", ProxySchema);
