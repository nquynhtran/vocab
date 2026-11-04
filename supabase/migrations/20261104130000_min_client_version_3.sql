-- Separate from the notes and pronunciation columns, and only once the code using them is live
-- (#68): raising it earlier would lock out the deployed app. Older clients drop those columns when
-- reading, so their Export would silently lose notes and pronunciations (#67).
update public.app_config set min_client_version = 3;
