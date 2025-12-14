// import { NextFunction, Request, Response } from "express";
// import { inject, injectable } from "tsyringe";
// import { log } from "console";
// import { AuthService } from "@services/auth";
// import {
//   VoyagerRequest,
//   UserVerificationOtpDTO,
//   UserBaseDTO,
//   UserLoginDTO,
//   UserSignUpDTO,
// } from "schemas";

// /**
//  * @todo Protect verification page navigation....
//  */
// @injectable()
// export class AuthController {
//   constructor(@inject(AuthService) private readonly _auth: AuthService) {}

//   public async signup(
//     request: VoyagerRequest<undefined, undefined, UserSignUpDTO>,
//     response: Response,
//     _next: NextFunction
//   ) {
//     try {
//       const user = await this._auth.createWithEmailAndPassword(request.body);
//       request.session.user = user;
//       return response.redirect("/auth/verification");
//     } catch (error) {
//       console.log(error);
//       response.render("signup", {
//         error_message: (error as Error).message.toString(),
//       });
//     }
//   }

//   public async login(
//     request: VoyagerRequest<undefined, undefined, UserLoginDTO>,
//     response: Response,
//     _next: NextFunction
//   ) {
//     try {
//       const user = await this._auth.signinWithEmailAndPassword(request.body);
//       request.session.user = user;
//       return response.redirect("/projects");
//     } catch (error) {
//       response.render("login", {
//         error_message: (error as Error).message.toString(),
//       });
//     }
//   }

//   public async verifyOTP(
//     request: VoyagerRequest<undefined, undefined, UserVerificationOtpDTO>,
//     response: Response,
//     next: NextFunction
//   ) {
//     try {
//       const { code } = request.body;
//       const publicId = request.session.user!.publicID;
//       await this._auth.verifyOTP(publicId, code);
//       response.redirect("/projects");
//     } catch (error) {
//       console.log(error);
//       response.render("verify", {
//         error_message: (error as Error).message.toString(),
//       });
//     }
//   }

//   public async resendOTP(request: VoyagerRequest, response: Response): Promise<void> {
//     try {
//       const userInfo: UserBaseDTO = request.session.user!;
//       await this._auth.resendOTPCode(userInfo);
//       request.flash("info_message", "Verification code has been sent to your email!");
//       response.redirect("/auth/verification");
//     } catch (error) {
//       log(error);
//       request.flash("error_message", (error as Error).message.toString());
//       response.redirect("/auth/verification");
//     }
//   }

//   public getLoginPage(request: VoyagerRequest, response: Response) {
//     response.render("login");
//   }

//   public getOTPVerificationPage(request: VoyagerRequest, response: Response) {
//     const error_messages = request.flash("error_message");
//     const info_messages = request.flash("info_message");
//     const error_message = error_messages.length > 0 ? error_messages[0] : null;
//     const info_message = info_messages.length > 0 ? info_messages[0] : null;
//     response.render("verify", {
//       error_message: error_message,
//       info_message: info_message,
//     });
//   }

//   public getSignUpPage(request: VoyagerRequest, response: Response) {
//     response.render("signup");
//   }

//   public getLandingPage(request: VoyagerRequest, response: Response) {
//     response.render("index");
//   }

//   public getStoryPage(request: VoyagerRequest, response: Response) {
//     response.render("story");
//   }

//   public logout(request: VoyagerRequest, response: Response) {
//     request.session.destroy((error: undefined) => {
//       if (error) return;
//       response.clearCookie("voyager_session");
//       response.redirect("/");
//     });
//   }
// }
