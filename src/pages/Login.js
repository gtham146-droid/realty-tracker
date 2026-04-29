import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { API } from "../config";
import { Button, Input, Field } from "../components/UI";

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await API.get("login", form);
      if (res.success) login(res);
      else setError(res.message || "Login failed");
    } catch {
      setError("Could not connect. Check your API URL in config.js");
    }
    setLoading(false);
  };

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-logo">
          <div className="logo-icon">⬡</div>
          <h1>RealtyTrack</h1>
          <p>Investment Syndication Platform</p>
        </div>
        <form onSubmit={handle}>
          <Field label="Username">
            <Input
              type="text"
              placeholder="admin or investor email"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              required
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
          </Field>
          {error && <div className="error-msg">{error}</div>}
          <Button type="submit" loading={loading} style={{ width: "100%", marginTop: 8 }}>
            Sign In
          </Button>
        </form>
        <div className="login-hint">
          Default admin: <code>admin / admin123</code>
        </div>
      </div>
    </div>
  );
}
