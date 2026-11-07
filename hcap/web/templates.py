import os


class TemplateCache:
    HTML_TEMPLATE = """
    <!DOCTYPE html>
    <html>
    <head>
      <title>hCaptcha</title>
      <script src="https://js.hcaptcha.com/1/api.js" async defer></script>
    </head>
    <body>
      <div class="h-captcha" data-sitekey="NOTASITEKEY"></div>
    </body>
    </html>
    """

    def __init__(self):
        current_dir = os.path.dirname(__file__)
        template_path = os.path.join(current_dir, "templates", "hcaptcha.html")
        api_path = os.path.join(current_dir, "static", "api.js")
        with open(template_path, "r", encoding="utf-8") as f:
            self.hcaptcha_html = f.read()

        with open(api_path, "r", encoding="utf-8") as f:
            self.api_js = f.read()

    def render_main(self, sitekey):
        return self.HTML_TEMPLATE.replace("NOTASITEKEY", sitekey)

    def render_hcaptcha(self, rqdata=None):
        html = self.hcaptcha_html
        if rqdata:
            html = html.replace("Zr = t", f'Zr = "{rqdata}"')
        return html
