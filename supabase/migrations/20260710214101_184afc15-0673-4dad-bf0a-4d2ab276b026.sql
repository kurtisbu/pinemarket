
DO $$
DECLARE
  sid uuid;
BEGIN
  SELECT id INTO sid FROM vault.secrets WHERE name = 'discord_alert_secret';
  IF sid IS NULL THEN
    PERFORM vault.create_secret('0883c1d0b233877f776dc4561c0eff2d585ed93206b1f6f50ee8afd3818dc523', 'discord_alert_secret');
  ELSE
    PERFORM vault.update_secret(sid, '0883c1d0b233877f776dc4561c0eff2d585ed93206b1f6f50ee8afd3818dc523');
  END IF;
END $$;
