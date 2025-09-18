declare module 'js-cookie' {
  export interface CookieAttributes {
    /**
     * Define when the cookie will be removed. Value can be a Number
     * which will be interpreted as days from time of creation or a
     * Date instance. If omitted, the cookie becomes a session cookie.
     */
    expires?: number | Date;

    /**
     * Define the path where the cookie is available. Defaults to '/'
     */
    path?: string;

    /**
     * Define the domain where the cookie is available. Defaults to
     * the domain of the page where the cookie was created.
     */
    domain?: string;

    /**
     * A Boolean indicating if the cookie transmission requires a
     * secure protocol (https). Defaults to false.
     */
    secure?: boolean;

    /**
     * Asserts that a cookie must not be sent with cross-origin requests,
     * providing some protection against cross-site request forgery
     * attacks (CSRF)
     */
    sameSite?: 'strict' | 'Strict' | 'lax' | 'Lax' | 'none' | 'None';

    /**
     * An attribute which will be serialized, conformably to RFC 6265
     * section 5.2.
     */
    [property: string]: any;
  }

  /**
   * Converts a cookie string into an object
   */
  function parse(str: string): { [key: string]: string };

  /**
   * Create a cookie
   */
  function set(name: string, value: string | object, options?: CookieAttributes): string;

  /**
   * Read cookie
   */
  function get(name?: string): string | { [key: string]: string } | undefined;

  /**
   * Delete cookie
   */
  function remove(name: string, options?: CookieAttributes): void;

  /**
   * Get all cookies
   */
  function getJSON(name?: string): { [key: string]: any } | string;

  /**
   * Set default cookie options
   */
  const defaults: CookieAttributes;

  /**
   * Set withCredentials to true
   */
  function withConverter(converter: Function): typeof Cookies;

  const noConflict: () => typeof Cookies;

  export default {
    set,
    get,
    getJSON,
    remove,
    defaults,
    withConverter,
    noConflict
  };
}