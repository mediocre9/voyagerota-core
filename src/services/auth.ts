import * as bcrypt from "bcrypt";
import * as UserDAL from "@dal/auth";
import * as OtpDAL from "@dal/otp";
import * as Utils from "@utils/utils";
import { IEmailQueue, EmailQueue, JobOtpTask } from "@queues/email-queue";
import { AuthError } from "@utils/error";
import { Logger } from "@utils/logger";
import { inject, injectable } from "tsyringe";
import {
  UserBaseDTO,
  UserLoginDTO,
  UserSignUpDTO,
  UserBaseSchema,
  UserLoginSchema,
  UserSignUpSchema,
} from "types";

/**
 * TODO [PRI-01] perform queries at DB Transcation level especially OTP related
 */
@injectable()
export class AuthService {
  constructor(
    @inject(EmailQueue)
    private readonly _emailQueue: IEmailQueue<JobOtpTask>
  ) {}

  public async createWithEmailAndPassword(payload: UserSignUpDTO): Promise<UserBaseDTO> {
    const { email, username, password } = await UserSignUpSchema.parseAsync(payload);

    if (await UserDAL.isEmailAlreadyInUse(email)) {
      throw new AuthError("User already exists!");
    }

    const user = await UserDAL.createUser(email, username, password);

    const code = Utils.generateOTPCode();
    await OtpDAL.createOTPCode(user.email, code);

    await this._emailQueue.enqueue({
      email: user.email,
      username: user.username,
      code: code,
      type: "verification",
    });

    Logger.info("OTP Email has been enqueued!");

    return {
      publicID: user.public_id!,
      username: user.username,
      email: user.email,
    };
  }

  public async signinWithEmailAndPassword(payload: UserLoginDTO): Promise<UserBaseDTO> {
    const { email, password } = await UserLoginSchema.parseAsync(payload);

    const user = await UserDAL.findUserByEmail(email);

    if (!user) {
      throw new AuthError("User with this email does not exists!");
    }

    const match = await bcrypt.compare(password, user.password!);
    if (!match) {
      throw new AuthError("Email or Password is incorrect!");
    }

    const id = user.public_id!;
    const verified = await UserDAL.isUserVerified(id);

    if (!verified) {
      const code = Utils.generateOTPCode();
      await OtpDAL.createOTPCode(id, code);

      await this._emailQueue.enqueue({
        email: user.email,
        username: user.username,
        code: code,
        type: "verification",
      });

      throw new AuthError(
        "Account is not verified! We have sent an OTP code to your email address for verification!"
      );
    }

    return {
      publicID: user.public_id!,
      username: user.username,
      email: user.email,
    };
  }

  public async verifyOTP(userId: string, otp: string): Promise<void> {
    const user = await UserDAL.findUserByPublicId(userId);
    if (!user) {
      throw new AuthError("User account not found!");
    }

    const id = user.public_id!;

    const expired = await OtpDAL.isOTPCodeExpired(id);
    if (expired) {
      throw new AuthError("OTP code has been expired!");
    }

    const match = await OtpDAL.compareOTPCode(id, otp);
    if (!match) {
      throw new AuthError("OTP verification failed! Please Try Again!");
    }

    await OtpDAL.removeOTPCode(id);
    await UserDAL.verifyUser(id);
  }

  public async resendOTPCode(payload: UserBaseDTO): Promise<void> {
    const { publicID } = await UserBaseSchema.parseAsync(payload);

    const user = await UserDAL.findUserByPublicId(publicID);
    if (!user) {
      throw new AuthError("User account not found!");
    }

    const id = user.public_id!;

    await OtpDAL.removeOTPCode(id);

    const code = Utils.generateOTPCode();

    await OtpDAL.createOTPCode(id, code);

    await this._emailQueue.enqueue({
      email: user.email,
      username: user.username,
      code: code,
      type: "verification",
    });
  }
}
