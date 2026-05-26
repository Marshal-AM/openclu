import {
  getPortalDevice,
  getPortalDeviceOrchestratorUrl,
  listPortalDevices,
  type PortalDeviceRow,
} from "@/lib/portal-db";

export type OwnedDevice = PortalDeviceRow;

export async function listDevicesForOwner(wallet: string): Promise<OwnedDevice[]> {
  const { devices } = await listPortalDevices(wallet);
  return devices;
}

/** Read selected device row constrained to the current owner wallet. */
export async function fetchOwnedDeviceById(
  ownerWallet: string,
  deviceId: string,
): Promise<OwnedDevice | null> {
  const { device } = await getPortalDevice(ownerWallet, deviceId);
  return device;
}

export async function fetchOwnedDeviceOrchestratorUrl(
  ownerWallet: string,
  deviceId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string; status: number }> {
  return getPortalDeviceOrchestratorUrl(ownerWallet, deviceId);
}
