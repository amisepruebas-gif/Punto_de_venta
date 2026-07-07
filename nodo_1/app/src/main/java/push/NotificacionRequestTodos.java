package push;

public class NotificacionRequestTodos {
    private String titulo;
    private String mensaje;
    private String tipo;

    public NotificacionRequestTodos(String titulo, String mensaje) {
        this.titulo = titulo;
        this.mensaje = mensaje;
        this.tipo = "general";
    }

    public NotificacionRequestTodos(String titulo, String mensaje, String tipo) {
        this.titulo = titulo;
        this.mensaje = mensaje;
        this.tipo = tipo;
    }
}
