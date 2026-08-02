begin;

insert into sites (site_key, site_name, base_domain, category, status)
values (
  'govuk-redundancy-pay-calculator',
  'GOV.UK Statutory Redundancy Pay Calculator',
  'www.gov.uk',
  'public_service',
  'active'
)
on conflict (site_key) do update
set
  site_name = excluded.site_name,
  base_domain = excluded.base_domain,
  category = excluded.category,
  status = excluded.status,
  updated_at = now();

insert into validation_rules (rule_key, rule_name, regex_pattern, description)
values (
  'govuk_redundancy_age_16_100',
  'GOV.UK redundancy calculator age',
  '^(1[6-9]|[2-9][0-9]|100)$',
  'Please enter an age between 16 and 100.'
)
on conflict (rule_key) do update
set
  rule_name = excluded.rule_name,
  regex_pattern = excluded.regex_pattern,
  description = excluded.description;

-- Archive only drafts that can be positively identified as belonging to this
-- calculator. Broad or unrelated GOV.UK drafts are intentionally preserved.
update templates t
set status = 'archived', updated_at = now()
where t.site_id in (
  select id from sites where base_domain = 'www.gov.uk'
)
  and t.status in ('draft', 'pending_review')
  and t.template_key not in (
    'govuk-redundancy-date',
    'govuk-redundancy-age',
    'govuk-redundancy-years-employed',
    'govuk-redundancy-weekly-pay',
    'govuk-redundancy-result'
  )
  and (
    t.template_json #>> '{workflow,workflowKey}' = 'govuk-redundancy-pay-workflow'
    or t.template_json #>> '{pageDetection,headingText}' in (
      'What date were you made redundant?',
      'How old were you on the date you were made redundant?',
      'How many years have you worked for your employer?',
      'What is your weekly pay before tax and any other deductions?',
      'Calculate your statutory redundancy pay: Information based on your answers'
    )
    or t.template_json ->> 'pageHeading' in (
      'What date were you made redundant?',
      'How old were you on the date you were made redundant?',
      'How many years have you worked for your employer?',
      'What is your weekly pay before tax and any other deductions?',
      'Calculate your statutory redundancy pay: Information based on your answers'
    )
    or exists (
      select 1
      from unnest(t.url_patterns) as pattern
      where pattern like 'https://www.gov.uk/calculate-your-redundancy-pay/%'
    )
  );

with selected_site as (
  select id from sites where site_key = 'govuk-redundancy-pay-calculator'
), template_specs (template_key, template_name, url_patterns, template_json) as (
  values
  (
    'govuk-redundancy-date',
    'GOV.UK Redundancy Pay - Redundancy Date',
    array[
      'https://www.gov.uk/calculate-your-redundancy-pay/y',
      'https://www.gov.uk/calculate-your-redundancy-pay/y?*'
    ]::text[],
    $json${
      "source": "manually-approved",
      "siteId": "govuk-redundancy-pay-calculator",
      "siteName": "GOV.UK Statutory Redundancy Pay Calculator",
      "templateKey": "govuk-redundancy-date",
      "templateName": "GOV.UK Redundancy Pay - Redundancy Date",
      "version": "1.0.0",
      "urlPatterns": [
        "https://www.gov.uk/calculate-your-redundancy-pay/y",
        "https://www.gov.uk/calculate-your-redundancy-pay/y?*"
      ],
      "pageDetection": {
        "headingText": "What date were you made redundant?",
        "requiredSelectors": ["#response-0", "#response-1", "#response-2"]
      },
      "workflow": {
        "workflowKey": "govuk-redundancy-pay-workflow",
        "pageKey": "redundancy-date",
        "pageOrder": 1,
        "totalPages": 5,
        "nextPageKey": "employee-age"
      },
      "fields": [
        {"id":"redundancy-day","label":"Day","type":"number","selector":"#response-0","required":true,"originalLabel":"Day","confidence":1,"events":["input","change"]},
        {"id":"redundancy-month","label":"Month","type":"number","selector":"#response-1","required":true,"originalLabel":"Month","confidence":1,"events":["input","change"]},
        {"id":"redundancy-year","label":"Year","type":"number","selector":"#response-2","required":true,"originalLabel":"Year","confidence":1,"events":["input","change"]}
      ],
      "instructions": [
        {"type":"fill","fieldId":"redundancy-day","selector":"#response-0","valueSource":"redundancy-day","metadata":{"controlType":"number","dispatchEvents":["input","change"],"manualContinueRequired":true}},
        {"type":"fill","fieldId":"redundancy-month","selector":"#response-1","valueSource":"redundancy-month","metadata":{"controlType":"number","dispatchEvents":["input","change"],"manualContinueRequired":true}},
        {"type":"fill","fieldId":"redundancy-year","selector":"#response-2","valueSource":"redundancy-year","metadata":{"controlType":"number","dispatchEvents":["input","change"],"manualContinueRequired":true}},
        {"type":"review","metadata":{"manualContinueRequired":true}}
      ],
      "policies":{"storePersonalData":false,"autoSubmit":false,"manualReviewRequired":true}
    }$json$::jsonb
  ),
  (
    'govuk-redundancy-age',
    'GOV.UK Redundancy Pay - Employee Age',
    array['https://www.gov.uk/calculate-your-redundancy-pay/y/*']::text[],
    $json${
      "source":"manually-approved",
      "siteId":"govuk-redundancy-pay-calculator",
      "siteName":"GOV.UK Statutory Redundancy Pay Calculator",
      "templateKey":"govuk-redundancy-age",
      "templateName":"GOV.UK Redundancy Pay - Employee Age",
      "version":"1.0.0",
      "urlPatterns":["https://www.gov.uk/calculate-your-redundancy-pay/y/*"],
      "pageDetection":{"headingText":"How old were you on the date you were made redundant?","requiredSelectors":["#response"]},
      "workflow":{"workflowKey":"govuk-redundancy-pay-workflow","pageKey":"employee-age","pageOrder":2,"totalPages":5,"nextPageKey":"years-employed"},
      "fields":[{"id":"employee-age","label":"Age","type":"number","selector":"#response","required":true,"validationRule":"govuk_redundancy_age_16_100","validationPattern":"^(1[6-9]|[2-9][0-9]|100)$","validationMessage":"Please enter an age between 16 and 100.","originalLabel":"How old were you on the date you were made redundant?","confidence":1,"events":["input","change"]}],
      "instructions":[
        {"type":"fill","fieldId":"employee-age","selector":"#response","valueSource":"employee-age","metadata":{"controlType":"number","dispatchEvents":["input","change"],"manualContinueRequired":true}},
        {"type":"review","metadata":{"manualContinueRequired":true}}
      ],
      "policies":{"storePersonalData":false,"autoSubmit":false,"manualReviewRequired":true}
    }$json$::jsonb
  ),
  (
    'govuk-redundancy-years-employed',
    'GOV.UK Redundancy Pay - Years Employed',
    array['https://www.gov.uk/calculate-your-redundancy-pay/y/*']::text[],
    $json${
      "source":"manually-approved",
      "siteId":"govuk-redundancy-pay-calculator",
      "siteName":"GOV.UK Statutory Redundancy Pay Calculator",
      "templateKey":"govuk-redundancy-years-employed",
      "templateName":"GOV.UK Redundancy Pay - Years Employed",
      "version":"1.0.0",
      "urlPatterns":["https://www.gov.uk/calculate-your-redundancy-pay/y/*"],
      "pageDetection":{"headingText":"How many years have you worked for your employer?","requiredSelectors":["#response"]},
      "workflow":{"workflowKey":"govuk-redundancy-pay-workflow","pageKey":"years-employed","pageOrder":3,"totalPages":5,"nextPageKey":"weekly-pay"},
      "fields":[{"id":"years-employed","label":"Full years employed","type":"number","selector":"#response","required":true,"originalLabel":"How many years have you worked for your employer?","confidence":1,"events":["input","change"]}],
      "instructions":[
        {"type":"fill","fieldId":"years-employed","selector":"#response","valueSource":"years-employed","metadata":{"controlType":"number","dispatchEvents":["input","change"],"manualContinueRequired":true}},
        {"type":"review","metadata":{"manualContinueRequired":true}}
      ],
      "policies":{"storePersonalData":false,"autoSubmit":false,"manualReviewRequired":true}
    }$json$::jsonb
  ),
  (
    'govuk-redundancy-weekly-pay',
    'GOV.UK Redundancy Pay - Weekly Pay',
    array['https://www.gov.uk/calculate-your-redundancy-pay/y/*']::text[],
    $json${
      "source":"manually-approved",
      "siteId":"govuk-redundancy-pay-calculator",
      "siteName":"GOV.UK Statutory Redundancy Pay Calculator",
      "templateKey":"govuk-redundancy-weekly-pay",
      "templateName":"GOV.UK Redundancy Pay - Weekly Pay",
      "version":"1.0.0",
      "urlPatterns":["https://www.gov.uk/calculate-your-redundancy-pay/y/*"],
      "pageDetection":{"headingText":"What is your weekly pay before tax and any other deductions?","requiredSelectors":["#response"]},
      "workflow":{"workflowKey":"govuk-redundancy-pay-workflow","pageKey":"weekly-pay","pageOrder":4,"totalPages":5,"nextPageKey":"result"},
      "fields":[{"id":"weekly-pay-before-tax","label":"Weekly pay before tax","type":"number","selector":"#response","required":true,"originalLabel":"What is your weekly pay before tax and any other deductions?","confidence":1,"events":["input","change"]}],
      "instructions":[
        {"type":"fill","fieldId":"weekly-pay-before-tax","selector":"#response","valueSource":"weekly-pay-before-tax","metadata":{"controlType":"number","dispatchEvents":["input","change"],"manualContinueRequired":true,"prefix":"£","suffix":"per week"}},
        {"type":"review","metadata":{"manualContinueRequired":true}}
      ],
      "policies":{"storePersonalData":false,"autoSubmit":false,"manualReviewRequired":true}
    }$json$::jsonb
  ),
  (
    'govuk-redundancy-result',
    'GOV.UK Redundancy Pay - Result',
    array['https://www.gov.uk/calculate-your-redundancy-pay/y/*']::text[],
    $json${
      "source":"manually-approved",
      "siteId":"govuk-redundancy-pay-calculator",
      "siteName":"GOV.UK Statutory Redundancy Pay Calculator",
      "templateKey":"govuk-redundancy-result",
      "templateName":"GOV.UK Redundancy Pay - Result",
      "version":"1.0.0",
      "urlPatterns":["https://www.gov.uk/calculate-your-redundancy-pay/y/*"],
      "pageDetection":{"headingText":"Calculate your statutory redundancy pay: Information based on your answers","requiredSelectors":["main h1.gem-c-heading__text.govuk-heading-xl"]},
      "workflow":{"workflowKey":"govuk-redundancy-pay-workflow","pageKey":"result","pageOrder":5,"totalPages":5,"nextPageKey":null},
      "fields":[],
      "instructions":[{"type":"review","metadata":{"completionOnly":true,"manualContinueRequired":false}}],
      "policies":{"storePersonalData":false,"autoSubmit":false,"manualReviewRequired":true}
    }$json$::jsonb
  )
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
  template_specs.template_key,
  template_specs.template_name,
  '1.0.0',
  'approved',
  template_specs.url_patterns,
  template_specs.template_json
from selected_site
cross join template_specs
on conflict (template_key) do update
set
  site_id = excluded.site_id,
  template_name = excluded.template_name,
  version = excluded.version,
  status = 'approved',
  url_patterns = excluded.url_patterns,
  template_json = excluded.template_json,
  updated_at = now();

delete from field_mappings
where template_id in (
  select id from templates where template_key in (
    'govuk-redundancy-date',
    'govuk-redundancy-age',
    'govuk-redundancy-years-employed',
    'govuk-redundancy-weekly-pay',
    'govuk-redundancy-result'
  )
);

with field_specs (template_key, field_key, label, input_type, selector, required, validation_rule, sort_order) as (
  values
    ('govuk-redundancy-date', 'redundancy-day', 'Day', 'number', '#response-0', true, null, 1),
    ('govuk-redundancy-date', 'redundancy-month', 'Month', 'number', '#response-1', true, null, 2),
    ('govuk-redundancy-date', 'redundancy-year', 'Year', 'number', '#response-2', true, null, 3),
    ('govuk-redundancy-age', 'employee-age', 'Age', 'number', '#response', true, 'govuk_redundancy_age_16_100', 1),
    ('govuk-redundancy-years-employed', 'years-employed', 'Full years employed', 'number', '#response', true, null, 1),
    ('govuk-redundancy-weekly-pay', 'weekly-pay-before-tax', 'Weekly pay before tax', 'number', '#response', true, null, 1)
)
insert into field_mappings (
  template_id,
  field_key,
  label,
  input_type,
  selector,
  required,
  validation_rule,
  sort_order
)
select
  t.id,
  f.field_key,
  f.label,
  f.input_type,
  f.selector,
  f.required,
  f.validation_rule,
  f.sort_order
from field_specs f
join templates t on t.template_key = f.template_key;

delete from runner_instructions
where template_id in (
  select id from templates where template_key in (
    'govuk-redundancy-date',
    'govuk-redundancy-age',
    'govuk-redundancy-years-employed',
    'govuk-redundancy-weekly-pay',
    'govuk-redundancy-result'
  )
);

with runner_specs (
  template_key,
  step_order,
  instruction_type,
  field_key,
  selector,
  value_source,
  metadata_json
) as (
  values
    ('govuk-redundancy-date', 1, 'fill', 'redundancy-day', '#response-0', 'redundancy-day', '{"controlType":"number","dispatchEvents":["input","change"],"manualContinueRequired":true}'::jsonb),
    ('govuk-redundancy-date', 2, 'fill', 'redundancy-month', '#response-1', 'redundancy-month', '{"controlType":"number","dispatchEvents":["input","change"],"manualContinueRequired":true}'::jsonb),
    ('govuk-redundancy-date', 3, 'fill', 'redundancy-year', '#response-2', 'redundancy-year', '{"controlType":"number","dispatchEvents":["input","change"],"manualContinueRequired":true}'::jsonb),
    ('govuk-redundancy-date', 4, 'review', null, null, null, '{"manualContinueRequired":true}'::jsonb),
    ('govuk-redundancy-age', 1, 'fill', 'employee-age', '#response', 'employee-age', '{"controlType":"number","dispatchEvents":["input","change"],"manualContinueRequired":true}'::jsonb),
    ('govuk-redundancy-age', 2, 'review', null, null, null, '{"manualContinueRequired":true}'::jsonb),
    ('govuk-redundancy-years-employed', 1, 'fill', 'years-employed', '#response', 'years-employed', '{"controlType":"number","dispatchEvents":["input","change"],"manualContinueRequired":true}'::jsonb),
    ('govuk-redundancy-years-employed', 2, 'review', null, null, null, '{"manualContinueRequired":true}'::jsonb),
    ('govuk-redundancy-weekly-pay', 1, 'fill', 'weekly-pay-before-tax', '#response', 'weekly-pay-before-tax', '{"controlType":"number","dispatchEvents":["input","change"],"manualContinueRequired":true,"prefix":"£","suffix":"per week"}'::jsonb),
    ('govuk-redundancy-weekly-pay', 2, 'review', null, null, null, '{"manualContinueRequired":true}'::jsonb),
    ('govuk-redundancy-result', 1, 'review', null, null, null, '{"completionOnly":true,"manualContinueRequired":false}'::jsonb)
)
insert into runner_instructions (
  template_id,
  step_order,
  instruction_type,
  field_key,
  selector,
  value_source,
  metadata_json
)
select
  t.id,
  r.step_order,
  r.instruction_type,
  r.field_key,
  r.selector,
  r.value_source,
  r.metadata_json
from runner_specs r
join templates t on t.template_key = r.template_key;

delete from instructions
where workflow_key = 'govuk-redundancy-pay-workflow';

with instruction_specs (
  template_key,
  page_key,
  step_order,
  heading_match,
  instruction_title,
  instruction_text,
  completion_rule,
  allowed_next_page_keys,
  out_of_order_message
) as (
  values
    (
      'govuk-redundancy-date',
      'redundancy-date',
      1,
      'What date were you made redundant?',
      'Step 1: Redundancy date',
      'Enter the day, month and year you were made redundant. Review the values, fill the original fields, and then select Continue on the GOV.UK page.',
      '{"require_overlay_validation":true,"require_original_fill_success":true,"manual_continue_required":true}'::jsonb,
      array['employee-age']::text[],
      'Complete the redundancy date step before opening the next question.'
    ),
    (
      'govuk-redundancy-age',
      'employee-age',
      2,
      'How old were you on the date you were made redundant?',
      'Step 2: Your age',
      'Enter the age you were on the date you were made redundant. Review the value, fill the original field, and then select Continue.',
      '{"require_overlay_validation":true,"require_original_fill_success":true,"manual_continue_required":true}'::jsonb,
      array['years-employed']::text[],
      'Complete the redundancy date step before entering your age.'
    ),
    (
      'govuk-redundancy-years-employed',
      'years-employed',
      3,
      'How many years have you worked for your employer?',
      'Step 3: Employment duration',
      'Enter the number of full years you worked for your employer. Use two years or more when testing the complete prototype path.',
      '{"require_overlay_validation":true,"require_original_fill_success":true,"manual_continue_required":true}'::jsonb,
      array['weekly-pay']::text[],
      'Complete the date and age steps before entering your employment duration.'
    ),
    (
      'govuk-redundancy-weekly-pay',
      'weekly-pay',
      4,
      'What is your weekly pay before tax and any other deductions?',
      'Step 4: Weekly pay',
      'Enter your weekly pay before tax and other deductions. Review the value, fill the original field, and then select Continue.',
      '{"require_overlay_validation":true,"require_original_fill_success":true,"manual_continue_required":true}'::jsonb,
      array['result']::text[],
      'Complete the previous three steps before entering your weekly pay.'
    ),
    (
      'govuk-redundancy-result',
      'result',
      5,
      'Calculate your statutory redundancy pay: Information based on your answers',
      'Calculation complete',
      'The guided calculator steps are complete. Review the official result shown by GOV.UK.',
      '{"require_overlay_validation":false,"require_original_fill_success":false,"manual_continue_required":false,"completes_workflow":true}'::jsonb,
      array[]::text[],
      'Complete all four calculator questions before opening the result.'
    )
)
insert into instructions (
  site_id,
  template_id,
  workflow_key,
  page_key,
  step_order,
  page_url,
  url_pattern,
  heading_match,
  instruction_title,
  instruction_text,
  completion_rule,
  allowed_next_page_keys,
  out_of_order_message,
  block_out_of_order,
  is_active
)
select
  t.site_id,
  t.id,
  'govuk-redundancy-pay-workflow',
  i.page_key,
  i.step_order,
  'https://www.gov.uk/calculate-your-redundancy-pay/y',
  'https://www.gov.uk/calculate-your-redundancy-pay/y%',
  i.heading_match,
  i.instruction_title,
  i.instruction_text,
  i.completion_rule,
  i.allowed_next_page_keys,
  i.out_of_order_message,
  true,
  true
from instruction_specs i
join templates t on t.template_key = i.template_key;

insert into template_versions (
  template_id,
  version,
  status,
  template_json,
  change_note,
  created_by
)
select
  t.id,
  '1.0.0',
  'approved',
  t.template_json,
  'Initial approved GOV.UK redundancy calculator template',
  'accesslens-developer'
from templates t
where t.template_key in (
  'govuk-redundancy-date',
  'govuk-redundancy-age',
  'govuk-redundancy-years-employed',
  'govuk-redundancy-weekly-pay',
  'govuk-redundancy-result'
)
on conflict (template_id, version) do update
set
  status = excluded.status,
  template_json = excluded.template_json,
  change_note = excluded.change_note,
  created_by = excluded.created_by;

update website_requests
set status = 'fulfilled', updated_at = now()
where status <> 'fulfilled'
  and url like 'https://www.gov.uk/calculate-your-redundancy-pay/%';

-- Verification queries. These run inside the transaction so a schema mismatch
-- aborts before commit.
select id, site_key, site_name, base_domain, category, status
from sites
where site_key = 'govuk-redundancy-pay-calculator';

select template_key, template_name, version, status, url_patterns
from templates
where template_key in (
  'govuk-redundancy-date',
  'govuk-redundancy-age',
  'govuk-redundancy-years-employed',
  'govuk-redundancy-weekly-pay',
  'govuk-redundancy-result'
)
order by template_key;

select t.template_key, fm.field_key, fm.label, fm.input_type, fm.selector,
       fm.required, fm.validation_rule, fm.sort_order
from field_mappings fm
join templates t on t.id = fm.template_id
where t.template_key like 'govuk-redundancy-%'
order by t.template_key, fm.sort_order;

select t.template_key, ri.step_order, ri.instruction_type, ri.field_key,
       ri.selector, ri.value_source, ri.metadata_json
from runner_instructions ri
join templates t on t.id = ri.template_id
where t.template_key like 'govuk-redundancy-%'
order by t.template_key, ri.step_order;

select workflow_key, page_key, step_order, template_id, heading_match,
       allowed_next_page_keys, completion_rule, is_active
from instructions
where workflow_key = 'govuk-redundancy-pay-workflow'
order by step_order;

select t.template_key, tv.version, tv.status, tv.change_note, tv.created_by
from template_versions tv
join templates t on t.id = tv.template_id
where t.template_key like 'govuk-redundancy-%'
order by t.template_key, tv.version;

commit;
