UPDATE menu_items SET icon = 'icon-cartoon'
WHERE microapp_name = 'cartoon-app' AND (icon IS NULL OR icon = '' OR icon = 'icon-precheck');

UPDATE menu_items SET icon = 'icon-precheck'
WHERE microapp_name = 'precheck-app' AND (icon IS NULL OR icon = '' OR icon = 'icon-cartoon');
