# Include INSIDE the existing llm-jp.com :443 VirtualHost.
RedirectMatch 302 "^/blood-test$" "/blood-test/"
Alias "/blood-test/" "/var/www/blood-test-review/"
<Directory "/var/www/blood-test-review">
    Options -Indexes
    AllowOverride None
    Require all granted
    DirectoryIndex index.html
</Directory>
# Reuse the existing /llmjp/ HTTPS proxy to api.kcg.edu.
