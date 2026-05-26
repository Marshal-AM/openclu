import {
  getPortalDevice,
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
