import styles from "./auth.module.scss";
import { IconButton } from "./button";

import { useNavigate } from "react-router-dom";
import { Path } from "../constant";
import Locale from "../locales";

import BotIcon from "../icons/bot.svg";
import { useEffect, useState } from "react";
import { EmojiAvatar } from "@/app/components/emoji";
import { showToast } from "@/app/components/ui-lib";
import { getHeaders } from "@/app/client/api";

export function AuthPage() {
  const navigate = useNavigate();

  const goHome = () => navigate(Path.Home);
  const goChat = () => navigate(Path.Chat);
  const goSettings = () => navigate(Path.Settings);

  const [showConfirm, setShowConfirm] = useState(false);

  const handlePasswordSubmit = (event: any) => {
    if (event.key === "Enter") {
      submitPassword();
    }
  };

  const submitPassword = () => {
    setShowConfirm(false);
    // @ts-ignore
    const password = document?.getElementById("shansingPassword")?.value;
    const passwordTwice = document?.getElementById(
      "shansingPasswordTwice",
      // @ts-ignore
    )?.value;
    if (!password || !passwordTwice) {
      showToast(Locale.Shansing.Auth.TipEmpty);
      setShowConfirm(true);
      return;
    }
    if (password !== passwordTwice) {
      showToast(Locale.Shansing.Auth.TipDifferent);
      setShowConfirm(true);
      return;
    }

    fetch("/api/shansing/password", {
      method: "post",
      body: JSON.stringify({ newPassword: password }),
      headers: {
        ...getHeaders(),
      },
    })
      .then((res) => res.json())
      .then((res: any) => {
        if (res.error) {
          throw Error(res.error);
        }
        showToast(Locale.Shansing.Auth.TipSuccess);
        location.href = "/";
      })
      .catch((e) => {
        setShowConfirm(true);
        showToast(Locale.Shansing.errorPrefix + e.message);
        console.error("[Auth] failed to change password", e);
      });
  }; // Reset access code to empty string

  useEffect(() => {
    setShowConfirm(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles["auth-page"]}>
      <div>
        <EmojiAvatar avatar="1f511" size={36} />
      </div>

      <div className={styles["auth-title"]}>{Locale.Shansing.Auth.Title}</div>
      <div className={styles["auth-tips"]}>{Locale.Shansing.Auth.Tips}</div>

      <input
        className={styles["auth-input"]}
        type="password"
        placeholder={Locale.Shansing.Auth.Input}
        id="shansingPassword"
        onKeyPress={handlePasswordSubmit}
      />

      <input
        className={styles["auth-input"]}
        type="password"
        placeholder={Locale.Shansing.Auth.InputTwice}
        id="shansingPasswordTwice"
        onKeyPress={handlePasswordSubmit}
      />

      <div className={styles["auth-actions"]}>
        <IconButton
          text={Locale.Shansing.Auth.Confirm}
          type="primary"
          onClick={submitPassword}
          disabled={!showConfirm}
        />
        <IconButton text={Locale.Shansing.Auth.Later} onClick={goSettings} />
      </div>
    </div>
  );
}
