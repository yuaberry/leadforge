"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOrgContext } from "@/server/auth/session";
import { withTenantDb } from "@/server/db/tenant";
import {
  getProduct,
  insertIntegration,
  insertLinkToken,
  insertProduct,
  setLinkTokenActive,
  updateProduct,
} from "@/server/db/repositories/commerce";
import { recordActivity } from "@/server/db/repositories/leads";
import {
  archiveProductSchema,
  createIntegrationSchema,
  createLinkTokenSchema,
  createManualSaleSchema,
  createProductSchema,
  parseSellingArguments,
  updateProductSchema,
} from "@/validators/commerce";
import { normalizeEmail } from "@/lib/format";

type CommerceState = { error?: string; success?: string } | null;

function productPatchFromForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? ""),
    platform: String(formData.get("platform") ?? ""),
    checkoutUrl: String(formData.get("checkoutUrl") ?? ""),
    price: String(formData.get("price") ?? ""),
    commissionPercent: String(formData.get("commissionPercent") ?? ""),
    category: String(formData.get("category") ?? ""),
    niche: String(formData.get("niche") ?? ""),
    imageUrl: String(formData.get("imageUrl") ?? ""),
    targetAudience: String(formData.get("targetAudience") ?? ""),
    sellingArguments: String(formData.get("sellingArguments") ?? ""),
    externalProductId: String(formData.get("externalProductId") ?? ""),
  };
}

export async function createProductAction(
  _prev: CommerceState,
  formData: FormData
): Promise<CommerceState> {
  const ctx = await requireOrgContext();

  const parsed = createProductSchema.safeParse(productPatchFromForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  let productId: string;
  try {
    const product = await withTenantDb(ctx.accessToken, (db) =>
      insertProduct(db, {
        organizationId: ctx.organization.id,
        name: parsed.data.name,
        type: parsed.data.type,
        platform: parsed.data.platform,
        checkoutUrl: parsed.data.checkoutUrl,
        price: parsed.data.price,
        commissionPercent: parsed.data.commissionPercent,
        category: parsed.data.category || null,
        niche: parsed.data.niche || null,
        imageUrl: parsed.data.imageUrl || null,
        targetAudience: parsed.data.targetAudience || null,
        sellingArguments: parseSellingArguments(parsed.data.sellingArguments),
        externalProductId: parsed.data.externalProductId || null,
      })
    );
    productId = product.id;
  } catch (erro) {
    return { error: erro instanceof Error ? erro.message : "Erro ao criar produto." };
  }

  revalidatePath("/products");
  redirect(`/products/${productId}`);
}

export async function updateProductAction(
  _prev: CommerceState,
  formData: FormData
): Promise<CommerceState> {
  const ctx = await requireOrgContext();

  const parsed = updateProductSchema.safeParse({
    productId: String(formData.get("productId") ?? ""),
    ...productPatchFromForm(formData),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { productId, ...fields } = parsed.data;

  try {
    await withTenantDb(ctx.accessToken, (db) =>
      updateProduct(db, ctx.organization.id, productId, {
        ...(fields.name !== undefined ? { name: fields.name } : {}),
        ...(fields.type !== undefined ? { type: fields.type } : {}),
        ...(fields.platform !== undefined ? { platform: fields.platform } : {}),
        ...(fields.checkoutUrl !== undefined ? { checkoutUrl: fields.checkoutUrl } : {}),
        ...(fields.price !== undefined ? { price: fields.price } : {}),
        ...(fields.commissionPercent !== undefined
          ? { commissionPercent: fields.commissionPercent }
          : {}),
        ...(fields.category !== undefined ? { category: fields.category || null } : {}),
        ...(fields.niche !== undefined ? { niche: fields.niche || null } : {}),
        ...(fields.imageUrl !== undefined ? { imageUrl: fields.imageUrl || null } : {}),
        ...(fields.targetAudience !== undefined
          ? { targetAudience: fields.targetAudience || null }
          : {}),
        ...(fields.sellingArguments !== undefined
          ? { sellingArguments: parseSellingArguments(fields.sellingArguments) }
          : {}),
        ...(fields.externalProductId !== undefined
          ? { externalProductId: fields.externalProductId || null }
          : {}),
      })
    );
  } catch (erro) {
    return { error: erro instanceof Error ? erro.message : "Erro ao salvar produto." };
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  return { success: "Produto atualizado." };
}

export async function setProductStatusAction(
  _prev: CommerceState,
  formData: FormData
): Promise<CommerceState> {
  const ctx = await requireOrgContext();

  const parsed = archiveProductSchema.safeParse({
    productId: String(formData.get("productId") ?? ""),
    status: String(formData.get("status") ?? ""),
  });
  if (!parsed.success) return { error: "Dados inválidos." };

  await withTenantDb(ctx.accessToken, (db) =>
    updateProduct(db, ctx.organization.id, parsed.data.productId, {
      status: parsed.data.status,
    })
  );

  revalidatePath(`/products/${parsed.data.productId}`);
  revalidatePath("/products");
  return { success: parsed.data.status === "active" ? "Produto reativado." : "Produto arquivado." };
}

export async function createLinkTokenAction(
  _prev: CommerceState,
  formData: FormData
): Promise<CommerceState> {
  const ctx = await requireOrgContext();

  const parsed = createLinkTokenSchema.safeParse({
    productId: String(formData.get("productId") ?? ""),
    label: String(formData.get("label") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await withTenantDb(ctx.accessToken, async (db) => {
      const product = await getProduct(db, ctx.organization.id, parsed.data.productId);
      if (!product) throw new Error("Produto não encontrado.");
      await insertLinkToken(db, {
        organizationId: ctx.organization.id,
        productId: product.id,
        label: parsed.data.label,
        token: randomBytes(12).toString("base64url"),
      });
    });
  } catch (erro) {
    return { error: erro instanceof Error ? erro.message : "Erro ao gerar link." };
  }

  revalidatePath(`/products/${parsed.data.productId}`);
  return { success: "Link rastreado gerado." };
}

export async function toggleLinkTokenAction(
  _prev: CommerceState,
  formData: FormData
): Promise<CommerceState> {
  const ctx = await requireOrgContext();

  const tokenId = String(formData.get("tokenId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!tokenId) return { error: "Dados inválidos." };

  await withTenantDb(ctx.accessToken, (db) =>
    setLinkTokenActive(db, ctx.organization.id, tokenId, active)
  );

  revalidatePath("/products");
  const productId = String(formData.get("productId") ?? "");
  if (productId) revalidatePath(`/products/${productId}`);
  return { success: active ? "Link reativado." : "Link desativado." };
}

export async function createIntegrationAction(
  _prev: CommerceState,
  formData: FormData
): Promise<CommerceState> {
  const ctx = await requireOrgContext();

  const parsed = createIntegrationSchema.safeParse({
    platform: String(formData.get("platform") ?? ""),
    name: String(formData.get("name") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await withTenantDb(ctx.accessToken, (db) =>
      insertIntegration(db, {
        organizationId: ctx.organization.id,
        platform: parsed.data.platform,
        name: parsed.data.name,
        webhookToken: randomBytes(24).toString("base64url"),
      })
    );
  } catch (erro) {
    return { error: erro instanceof Error ? erro.message : "Erro ao criar integração." };
  }

  revalidatePath("/integrations");
  return { success: "Integração criada — copie a URL do webhook abaixo." };
}

export async function createManualSaleAction(
  _prev: CommerceState,
  formData: FormData
): Promise<CommerceState> {
  const ctx = await requireOrgContext();

  const parsed = createManualSaleSchema.safeParse({
    productId: String(formData.get("productId") ?? ""),
    platform: String(formData.get("platform") ?? ""),
    externalOrderId: String(formData.get("externalOrderId") ?? ""),
    customerName: String(formData.get("customerName") ?? ""),
    customerEmail: String(formData.get("customerEmail") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    commissionAmount: String(formData.get("commissionAmount") ?? ""),
    occurredAt: String(formData.get("occurredAt") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const result = await withTenantDb(ctx.accessToken, async (db) => {
      const { findSaleByExternalOrderId, insertSale } = await import(
        "@/server/db/repositories/commerce"
      );

      const existing = await findSaleByExternalOrderId(
        db,
        ctx.organization.id,
        parsed.data.platform,
        parsed.data.externalOrderId
      );
      if (existing) {
        return { duplicated: true as const };
      }

      const occurredAt = parsed.data.occurredAt
        ? new Date(parsed.data.occurredAt).toISOString()
        : new Date().toISOString();

      const sale = await insertSale(db, {
        organizationId: ctx.organization.id,
        productId: parsed.data.productId || null,
        platform: parsed.data.platform,
        externalOrderId: parsed.data.externalOrderId,
        customerName: parsed.data.customerName || null,
        customerEmail: parsed.data.customerEmail || null,
        customerEmailNormalized: parsed.data.customerEmail
          ? normalizeEmail(parsed.data.customerEmail)
          : null,
        amount: parsed.data.amount,
        commissionAmount: parsed.data.commissionAmount,
        status: "paid",
        source: "manual",
        occurredAt,
        utm: {},
      });

      await recordActivity(db, {
        organizationId: ctx.organization.id,
        type: "sale_recorded",
        entityType: "sale",
        entityId: sale.id,
        actorId: ctx.user.id,
        metadata: { platform: parsed.data.platform, manual: true },
      });
      return { duplicated: false as const };
    });

    if (result.duplicated) {
      return { error: "Já existe uma venda com este ID de pedido nesta plataforma." };
    }
  } catch (erro) {
    return { error: erro instanceof Error ? erro.message : "Erro ao registrar venda." };
  }

  revalidatePath("/sales");
  revalidatePath("/dashboard");
  return { success: "Venda registrada." };
}
