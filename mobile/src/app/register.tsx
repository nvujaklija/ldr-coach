import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Body, Button, Card, ErrorText, Field, H1, Muted, Screen } from "@/theme/ui";
import { colors } from "@/theme/tokens";

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await register(email.trim(), password, displayName.trim());
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <H1 highlight="space">Create your</H1>
      <Muted>One account per person. Pair up with your partner once you&apos;re in.</Muted>
      <Card>
        <Field
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="e.g. Alex"
          autoCapitalize="words"
        />
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
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="At least 8 characters"
        />
        <ErrorText>{error}</ErrorText>
        <Button
          title="Create account"
          onPress={onSubmit}
          loading={submitting}
          disabled={!email || !password || !displayName}
        />
      </Card>
      <View style={{ flexDirection: "row", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
        <Body style={{ color: colors.muted }}>Already have an account?</Body>
        <Link href="/login" style={{ color: colors.dawn, fontWeight: "600" }}>
          Sign in
        </Link>
      </View>
    </Screen>
  );
}
