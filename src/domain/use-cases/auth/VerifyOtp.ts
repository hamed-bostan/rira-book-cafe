import type { AuthIdentity, IAuthRepository } from "../../repositories/IAuthRepository";

export class VerifyOtp {
  constructor(private readonly authRepo: IAuthRepository) {}

  execute(phone: string, code: string): Promise<AuthIdentity | null> {
    const normalizedPhone = phone.trim();
    const normalizedCode = code.trim();

    if (!normalizedPhone || !normalizedCode) {
      return Promise.resolve(null);
    }

    return this.authRepo.verifyOtp(normalizedPhone, normalizedCode);
  }
}
