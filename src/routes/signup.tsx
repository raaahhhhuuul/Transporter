import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, Bus, Lock, Mail, Loader2, Phone, Truck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { getSession, signUpUser, type RegistrableRole } from "@/lib/auth";

export function SignUpPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<RegistrableRole>("student");
  const [name, setName] = useState("");
  const [loginId, setLoginId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (session) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (!name || !loginId || !phoneNumber || !password || !confirmPassword) {
      toast.error("Please fill all fields.");
      return;
    }

    if (role === "student" && !loginId.trim().toLowerCase().endsWith("@srmist.edu.in")) {
      toast.error("Student signup requires @srmist.edu.in email.");
      return;
    }

    if (!/^\+?[0-9]{10,15}$/.test(phoneNumber.trim())) {
      toast.error("Enter a valid phone number.");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    window.setTimeout(async () => {
      try {
        await signUpUser({
          name,
          loginId,
          phoneNumber,
          role,
          password,
        });

        setLoading(false);
        toast.success("Signup submitted", {
          description: "Account created successfully. Approval will be requested when you login.",
        });
        navigate("/login");
      } catch (error) {
        setLoading(false);
        toast.error("Unable to sign up", {
          description:
            error instanceof Error ? error.message : "Please check your details and try again.",
        });
      }
    }, 700);
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-10">
      <div className="absolute inset-0 -z-10 gradient-map-bg" />
      <div className="absolute inset-0 -z-10 map-grid opacity-40" />
      <div className="absolute -left-20 top-10 -z-10 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="absolute -right-20 bottom-10 -z-10 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />

      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="w-full max-w-2xl"
      >
        <div className="rounded-3xl border border-border/60 bg-card/95 p-7 shadow-elegant backdrop-blur-xl sm:p-9">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-glow">
              <Bus className="h-7 w-7 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Create account</h1>
            <p className="mt-1 text-sm text-muted-foreground">Register as student or driver</p>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-surface p-1.5">
            <button
              type="button"
              onClick={() => setRole("student")}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                role === "student"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              Student Signup
            </button>
            <button
              type="button"
              onClick={() => setRole("driver")}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                role === "driver"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              Driver Signup
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
            <Field
              icon={<UserRound className="h-4 w-4" />}
              label="Full name"
            >
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your full name"
                className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </Field>
            <Field
              icon={
                role === "student" ? <Mail className="h-4 w-4" /> : <Truck className="h-4 w-4" />
              }
              label={role === "student" ? "Student email" : "Driver login ID"}
            >
              <input
                type={role === "student" ? "email" : "text"}
                value={loginId}
                onChange={(event) => setLoginId(event.target.value)}
                placeholder={role === "student" ? "name@srmist.edu.in" : "driver001"}
                className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </Field>
            <Field
              icon={<Phone className="h-4 w-4" />}
              label="Phone number"
            >
              <input
                type="tel"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="e.g. +919876543210"
                className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </Field>
            <Field
              icon={<Lock className="h-4 w-4" />}
              label="Password"
            >
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </Field>
            <Field
              icon={<Lock className="h-4 w-4" />}
              label="Confirm password"
            >
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm password"
                className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full items-center justify-center gap-2 rounded-2xl gradient-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-glow transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating account...
                </>
              ) : (
                "Sign up"
              )}
            </button>
          </form>

          <div className="mt-5 border-t border-border pt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="font-semibold text-primary hover:underline"
              >
                Login
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface px-3.5 py-3 transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
        <span className="text-muted-foreground">{icon}</span>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
