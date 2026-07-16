insert into sites (site_key, site_name, base_domain, category, status)
values (
  'selenium-web-form',
  'Selenium Web Form',
  'selenium.dev',
  'demo',
  'active'
)
on conflict (site_key) do update
set
  site_name = excluded.site_name,
  base_domain = excluded.base_domain,
  category = excluded.category,
  status = excluded.status,
  updated_at = now();

with selected_site as (
  select id from sites where site_key = 'selenium-web-form'
)
insert into templates (
  site_id,
  template_key,
  template_name,
  version,
  status,
  url_patterns,
  template_json
)
select
  selected_site.id,
  'selenium-web-form-basic',
  'Selenium Web Form Basic Template',
  '1.0.0',
  'approved',
  array['https://www.selenium.dev/selenium/web/web-form.html'],
  '{
    "siteId": "selenium-web-form",
    "siteName": "Selenium Web Form",
    "templateKey": "selenium-web-form-basic",
    "templateName": "Selenium Web Form Basic Template",
    "version": "1.0.0",
    "urlPatterns": [
      "https://www.selenium.dev/selenium/web/web-form.html"
    ],
    "fields": [
      {
        "id": "textInput",
        "label": "Text Input",
        "type": "text",
        "selector": "[name=\"my-text\"]",
        "required": true
      },
      {
        "id": "password",
        "label": "Password",
        "type": "password",
        "selector": "[name=\"my-password\"]",
        "required": true
      },
      {
        "id": "datalist",
        "label": "Dropdown Datalist",
        "type": "text",
        "selector": "[name=\"my-datalist\"]",
        "required": true
      },
      {
        "id": "textarea",
        "label": "Textarea",
        "type": "textarea",
        "selector": "[name=\"my-textarea\"]",
        "required": false
      }
    ],
    "instructions": [
      {
        "type": "fill",
        "fieldId": "textInput",
        "selector": "[name=\"my-text\"]"
      },
      {
        "type": "fill",
        "fieldId": "password",
        "selector": "[name=\"my-password\"]"
      },
      {
        "type": "fill",
        "fieldId": "datalist",
        "selector": "[name=\"my-datalist\"]"
      },
      {
        "type": "fill",
        "fieldId": "textarea",
        "selector": "[name=\"my-textarea\"]"
      },
      {
        "type": "review"
      }
    ]
  }'::jsonb
from selected_site
on conflict (template_key) do update
set
  template_name = excluded.template_name,
  version = excluded.version,
  status = excluded.status,
  url_patterns = excluded.url_patterns,
  template_json = excluded.template_json,
  updated_at = now();

insert into validation_rules (rule_key, rule_name, regex_pattern, description)
values
  ('sri_lankan_nic_old', 'Sri Lankan old NIC', '^[0-9]{9}[vVxX]$', 'Old NIC format such as 123456789V'),
  ('sri_lankan_nic_new', 'Sri Lankan new NIC', '^[0-9]{12}$', 'New 12 digit NIC format'),
  ('sri_lankan_mobile', 'Sri Lankan mobile number', '^(\\+94|0)?7[0-9]{8}$', 'Mobile number with local or international prefix')
on conflict (rule_key) do update
set
  rule_name = excluded.rule_name,
  regex_pattern = excluded.regex_pattern,
  description = excluded.description;
