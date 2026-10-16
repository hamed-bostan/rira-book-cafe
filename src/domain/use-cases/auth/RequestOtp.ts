import type { IAuthRepository } from "../../repositories/IAuthRepository";

export class RequestOtp {
  constructor(private readonly authRepo: IAuthRepository) {}

  execute(phone: string): Promise<boolean> {
    const normalizedPhone = phone.trim();

    if (!normalizedPhone) {
      return Promise.resolve(false);
    }

    return this.authRepo.requestOtp(normalizedPhone);
  }
}
