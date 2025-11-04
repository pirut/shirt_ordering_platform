import { Authenticated, Unauthenticated, useAction, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useEffect } from "react";
import { toast } from "sonner";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { Dashboard } from "./components/Dashboard";
import { CompanySetup } from "./components/CompanySetup";

export default function App() {
  const verify = useMutation(api.verification.verifyToken);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("verify");
    if (token) {
      verify({ token })
        .then(() => toast.success("Email verified!"))
        .catch((e) => {
          console.error(e);
          toast.error("Verification link invalid or expired.");
        })
        .finally(() => {
          params.delete("verify");
          const url = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
          window.history.replaceState({}, "", url);
        });
    }
  }, [verify]);
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-16 flex justify-between items-center border-b shadow-sm px-4">
        <h2 className="text-xl font-semibold text-blue-600">ShirtOrder Pro</h2>
        <Authenticated>
          <div className="flex items-center space-x-4">
            <SignOutButton />
          </div>
        </Authenticated>
      </header>
      <main className="flex-1">
        <Content />
      </main>
      <Toaster />
    </div>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const userCompany = useQuery(api.companies.getUserCompany);
  const sendVerification = useAction(api.verification.sendVerificationEmail);

  // After a successful sign up, send verification email once auth is established.
  // This avoids calling the action before the auth state is available server-side.
  useEffect(() => {
    if (!loggedInUser) return;
    let flagged = false;
    try {
      flagged = sessionStorage.getItem("postSignUpSendVerify") === "1";
    } catch {
      flagged = false;
    }
    if (!flagged) return;
    (async () => {
      try {
        await sendVerification({});
        toast.success("Verification email sent. Please check your inbox.");
      } catch (e) {
        console.error(e);
        toast.error("Signed up, but failed to send verification email.");
      } finally {
        try {
          sessionStorage.removeItem("postSignUpSendVerify");
        } catch {}
      }
    })();
  }, [loggedInUser, sendVerification]);

  if (loggedInUser === undefined || userCompany === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Authenticated>
        {userCompany ? (
          <Dashboard company={userCompany} />
        ) : (
          <CompanySetup />
        )}
      </Authenticated>
      
      <Unauthenticated>
        <div className="flex items-center justify-center min-h-[600px] p-8">
          <div className="w-full max-w-md mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to ShirtOrder Pro</h1>
              <p className="text-xl text-gray-600">
                Streamline your company's shirt ordering process
              </p>
            </div>
            <SignInForm />
          </div>
        </div>
      </Unauthenticated>
    </div>
  );
}
