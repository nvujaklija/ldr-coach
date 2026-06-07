import { Link, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Body, Button, Card, ErrorText, Field, H1, Screen } from "@/theme/ui";
import { colors } from "@/theme/tokens";

export default function LoginScreen() {
  const { login, token, loading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in? Skip the form.
  useEffect(() => {
    if (!loading && token) router.replace("/");
  }, [loading, token, router]);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <H1 highlight="back">Welcome</H1>
      <Card>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          placeholder="you@example.com"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          placeholder="••••••••"
        />
        <ErrorText>{error}</ErrorText>
        <Button title="Sign in" onPress={onSubmit} loading={submitting} disabled={!email || !password} />
      </Card>
      <View style={{ flexDirection: "row", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
        <Body style={{ color: colors.muted }}>New here?</Body>
        <Link href="/register" style={{ color: colors.dawn, fontWeight: "600" }}>
          Create an account
        </Link>
      </View>
    </Screen>
  );
}
