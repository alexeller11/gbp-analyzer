import { eq } from "drizzle-orm";
import { db } from "../db.ts";
import { gbpAccounts } from "../../drizzle/schema.ts";
import { getValidGoogleAccessToken } from "./google-connection.service.ts";

function extractAccountId(name: string) {
  const parts = name.split("/");
  return parts[parts.length - 1] || name;
}

export async function importGoogleBusinessAccounts(userId: number) {
  const { accessToken, connection } = await getValidGoogleAccessToken(userId);

  const response = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Erro ao buscar contas GBP:", data);
    throw new Error("Falha ao buscar contas do Google Business Profile");
  }

  const accounts = Array.isArray(data.accounts) ? data.accounts : [];

  let imported = 0;

  for (const account of accounts) {
    const googleAccountName = String(account.name || "");
    const accountId = extractAccountId(googleAccountName);
    const accountDisplayName = account.accountName ? String(account.accountName) : null;
    const accountType = account.type ? String(account.type) : null;

    const existing = await db.query.gbpAccounts.findFirst({
      where: eq(gbpAccounts.googleAccountName, googleAccountName)
    });

    if (!existing) {
      await db.insert(gbpAccounts).values({
        userId,
        googleConnectionId: connection.id,
        googleAccountName,
        accountId,
        accountDisplayName,
        accountType,
        rawJson: account,
        updatedAt: new Date()
      });

      imported += 1;
    } else {
      await db
        .update(gbpAccounts)
        .set({
          accountId,
          accountDisplayName,
          accountType,
          rawJson: account,
          updatedAt: new Date()
        })
        .where(eq(gbpAccounts.id, existing.id));
    }
  }

  const storedAccounts = await db.query.gbpAccounts.findMany({
    where: eq(gbpAccounts.userId, userId)
  });

  return {
    imported,
    totalDiscovered: accounts.length,
    totalStored: storedAccounts.length,
    accounts: storedAccounts.map((item) => ({
      id: item.id,
      accountId: item.accountId,
      accountDisplayName: item.accountDisplayName,
      accountType: item.accountType,
      googleAccountName: item.googleAccountName
    }))
  };
}
