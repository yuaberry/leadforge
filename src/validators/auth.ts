import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().email("Informe um e-mail válido"),
  password: z.string().min(1, "Informe sua senha"),
});

export const signUpSchema = z.object({
  name: z.string().min(2, "Informe seu nome").max(120, "Nome muito longo"),
  email: z.string().email("Informe um e-mail válido"),
  password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres").max(72, "Senha muito longa"),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;

/** Estado compartilhado entre Server Actions de auth e formulários (useActionState). */
export type AuthState = { error?: string; success?: string } | null;
