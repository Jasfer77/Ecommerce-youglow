<?php

namespace Tests\Feature;

use Tests\TestCase;

class SeoTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'app.url' => 'https://youglow.example',
            'app.indexable' => true,
        ]);
    }

    public function test_home_page_has_search_and_social_metadata(): void
    {
        $response = $this->get('/');

        $response->assertOk()
            ->assertHeader('X-Robots-Tag', 'index, follow')
            ->assertSee('<link rel="canonical" href="https://youglow.example/" />', false)
            ->assertSee('<meta property="og:type" content="website" />', false)
            ->assertSee('"@type":"FAQPage"', false)
            ->assertDontSee('{{APP_URL}}', false);
    }

    public function test_products_page_has_one_canonical_url(): void
    {
        $this->get('/products')
            ->assertOk()
            ->assertHeader('X-Robots-Tag', 'index, follow')
            ->assertSee('<link rel="canonical" href="https://youglow.example/products">', false)
            ->assertSee('"@type":"CollectionPage"', false);

        $this->get('/shop')->assertRedirect('/products', 301);
    }

    public function test_robots_file_points_to_sitemap_and_blocks_private_areas(): void
    {
        $this->get('/robots.txt')
            ->assertOk()
            ->assertHeader('Content-Type', 'text/plain; charset=UTF-8')
            ->assertSee("Disallow: /account", false)
            ->assertSee("Disallow: /admin", false)
            ->assertSee("Disallow: /api/", false)
            ->assertSee('Sitemap: https://youglow.example/sitemap.xml', false);
    }

    public function test_sitemap_contains_only_public_pages(): void
    {
        $response = $this->get('/sitemap.xml');

        $response->assertOk()
            ->assertHeader('Content-Type', 'application/xml; charset=UTF-8')
            ->assertSee('<loc>https://youglow.example/</loc>', false)
            ->assertSee('<loc>https://youglow.example/products</loc>', false)
            ->assertDontSee('/account', false)
            ->assertDontSee('/admin', false);
    }

    public function test_customer_account_is_marked_private_for_search_engines(): void
    {
        $this->get('/account')
            ->assertOk()
            ->assertHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    }

    public function test_admin_login_is_marked_private_for_search_engines(): void
    {
        $this->get('/admin/login')
            ->assertOk()
            ->assertHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    }

    public function test_non_indexable_environment_blocks_search_engines(): void
    {
        config(['app.indexable' => false]);

        $this->get('/')
            ->assertOk()
            ->assertHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');

        $this->get('/robots.txt')
            ->assertOk()
            ->assertSee("User-agent: *\nDisallow: /", false)
            ->assertDontSee('Sitemap:', false);
    }
}
