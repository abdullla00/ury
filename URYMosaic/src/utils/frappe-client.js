import { FrappeApp } from "frappe-js-sdk";

const host = window.location.hostname;
const port = window.location.port;
const protocol = window.location.protocol;

export const siteUrl = port ? `${protocol}//${host}:${port}` : `${protocol}//${host}`;
export const frappe = new FrappeApp(siteUrl);
export const frappeCall = frappe.call();
